/**
 * Phase 43E — Independent OpenAI analysis engine for immutable market snapshots.
 */
import { randomUUID } from "node:crypto";
import { getAnalysisSnapshotEngine } from "../../market-data/analysis-snapshot/index.js";
import type { AnalysisMarketSnapshot } from "../../market-data/analysis-snapshot/types.js";
import { parseAnalysisPeriodId } from "../../market-data/analysis-snapshot/periods.js";
import { parseCanonicalTimeframe } from "../../market-data/providers/contracts.js";
import { parseMarketProviderId } from "../../market-data/providers/identity.js";
import { buildEvidenceFromSnapshot } from "../snapshot-local/evidence-from-snapshot.js";
import { verifySnapshotFingerprint } from "../snapshot-local/engine.js";
import {
  buildGuidedAnalysisResponse,
  validateTradeAllocation,
} from "../analysis-response/index.js";
import { enrichAnalysisWithPositionRisk } from "../position-sizing/index.js";
import { attachPlanBundleToAnalysis } from "../snapshot-plans/index.js";
import { getForexOpenAiConfigStore, type ForexOpenAiConfigStore } from "./config-store.js";
import { getOpenAiInferenceGate } from "./concurrency.js";
import { isOpenAiChatEligibleModel } from "./model-policy.js";
import {
  buildOpenAiNoTradeResult,
  normalizeOpenAiAnalysisFromModel,
} from "./normalize.js";
import { openAiChatJson } from "./openai-client.js";
import {
  buildOpenAiRepairPrompt,
  buildOpenAiSystemPrompt,
  buildOpenAiUserPrompt,
} from "./prompts.js";
import { getOpenAiSnapshotAnalysisStore, type OpenAiSnapshotAnalysisStore } from "./store.js";
import type {
  OpenAiSnapshotAnalysisApiResult,
  OpenAiSnapshotAnalysisRequest,
  OpenAiSnapshotAnalysisResult,
} from "./types.js";

async function withPlans(
  analysis: OpenAiSnapshotAnalysisResult,
  snapshot: AnalysisMarketSnapshot,
  tradeAllocation?: { amount: number; currency: string } | null,
): Promise<OpenAiSnapshotAnalysisResult> {
  const planned = attachPlanBundleToAnalysis(analysis, snapshot, "OPENAI");
  const enriched = await enrichAnalysisWithPositionRisk(planned, snapshot, {
    tradeAllocation: tradeAllocation ?? null,
  });
  return {
    ...enriched,
    guidedResponse: buildGuidedAnalysisResponse({
      source: {
        ...enriched,
        analysisProvider: "OPENAI",
        instrument: enriched.instrument,
        provider: String(enriched.provider),
      },
      tradeAllocation: tradeAllocation ?? null,
    }),
  };
}

export const OPENAI_DEFAULT_TIMEOUT_MS = 90_000;
export const OPENAI_MIN_TIMEOUT_MS = 15_000;
export const OPENAI_MAX_TIMEOUT_MS = 180_000;

function clampTimeout(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : OPENAI_DEFAULT_TIMEOUT_MS;
  return Math.max(OPENAI_MIN_TIMEOUT_MS, Math.min(OPENAI_MAX_TIMEOUT_MS, Math.floor(n)));
}

function fail(started: number, code: string, error: string): OpenAiSnapshotAnalysisApiResult {
  return {
    ok: false,
    code,
    error,
    latencyMs: Date.now() - started,
    analysis: null,
    evidence: null,
  };
}

type ChatFn = typeof openAiChatJson;

export class OpenAiSnapshotAnalysisEngine {
  constructor(
    private readonly deps?: {
      getSnapshot?: (id: string) => Promise<AnalysisMarketSnapshot | null>;
      store?: OpenAiSnapshotAnalysisStore;
      config?: ForexOpenAiConfigStore;
      chat?: ChatFn;
    },
  ) {}

  private async loadSnapshot(id: string): Promise<AnalysisMarketSnapshot | null> {
    if (this.deps?.getSnapshot) return this.deps.getSnapshot(id);
    return getAnalysisSnapshotEngine().getSnapshot(id);
  }

  async analyze(raw: OpenAiSnapshotAnalysisRequest): Promise<OpenAiSnapshotAnalysisApiResult> {
    const started = Date.now();
    const tradeAllocation = (() => {
      if (raw.tradeAllocation == null) return null;
      const parsed = validateTradeAllocation(raw.tradeAllocation);
      return parsed.ok ? parsed.value : null;
    })();
    const snapshotId = String(raw.snapshotId ?? "").trim();
    if (!snapshotId) {
      return fail(started, "INVALID_REQUEST", "snapshotId is required.");
    }

    const config = this.deps?.config ?? getForexOpenAiConfigStore();
    const status = await config.getPublicStatus();
    if (!status.vaultUnlocked) {
      return fail(
        started,
        "SECRETS_VAULT_LOCKED",
        "OpenAI secret vault is locked on the server.",
      );
    }
    if (!status.configured) {
      return fail(
        started,
        "OPENAI_NOT_CONFIGURED",
        "OpenAI API key is not configured in Forex Admin.",
      );
    }

    let apiKey: string | null;
    try {
      apiKey = await config.getApiKey();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "SECRET_DECRYPT_FAILED";
      return fail(
        started,
        code,
        err instanceof Error ? err.message.slice(0, 200) : "Failed to load OpenAI API key.",
      );
    }
    if (!apiKey) {
      return fail(started, "OPENAI_NOT_CONFIGURED", "OpenAI API key is not configured.");
    }

    const snapshot = await this.loadSnapshot(snapshotId);
    if (!snapshot) {
      return fail(started, "SNAPSHOT_NOT_FOUND", "Snapshot not found.");
    }
    if (!verifySnapshotFingerprint(snapshot)) {
      return fail(
        started,
        "SNAPSHOT_FINGERPRINT_MISMATCH",
        "Stored snapshot failed integrity verification.",
      );
    }
    if (raw.contentFingerprint) {
      const expected = String(raw.contentFingerprint).trim();
      if (expected && expected !== snapshot.contentFingerprint) {
        return fail(
          started,
          "SNAPSHOT_FINGERPRINT_MISMATCH",
          "Provided contentFingerprint does not match the stored snapshot.",
        );
      }
    }
    if (raw.provider) {
      const p = parseMarketProviderId(raw.provider);
      if (!p || p !== snapshot.provider) {
        return fail(started, "SNAPSHOT_IDENTITY_MISMATCH", "Provider does not match snapshot.");
      }
    }
    if (raw.symbol) {
      const sym = String(raw.symbol).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const snapSym = snapshot.instrument.canonicalSymbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const display = snapshot.instrument.displaySymbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (sym && sym !== snapSym && sym !== display) {
        return fail(started, "SNAPSHOT_IDENTITY_MISMATCH", "Instrument does not match snapshot.");
      }
    }
    if (raw.candleTimeframe) {
      const tf = parseCanonicalTimeframe(raw.candleTimeframe);
      if (!tf || tf !== snapshot.candleTimeframe) {
        return fail(started, "SNAPSHOT_IDENTITY_MISMATCH", "Candle timeframe does not match snapshot.");
      }
    }
    if (raw.analysisPeriod) {
      const period = parseAnalysisPeriodId(raw.analysisPeriod);
      if (!period || period !== snapshot.analysisPeriod) {
        return fail(started, "SNAPSHOT_IDENTITY_MISMATCH", "Analysis period does not match snapshot.");
      }
    }

    const evidence = buildEvidenceFromSnapshot(snapshot);
    const analysisId = randomUUID();
    const timeoutMs = clampTimeout(raw.timeoutMs);
    const model = await config.getModel();
    // Never silently substitute a hardcoded model when the saved selection is ineligible.
    if (!isOpenAiChatEligibleModel(model)) {
      return fail(
        started,
        "MODEL_NOT_ELIGIBLE",
        `Configured OpenAI model "${model}" is not eligible for snapshot chat analysis. `
          + "Update the model in Forex Admin.",
      );
    }
    const store = this.deps?.store ?? getOpenAiSnapshotAnalysisStore();
    const newsResearchStatus = "unavailable" as const; // No safe news integration in 43E.

    if (!snapshot.evidenceReady) {
      const analysis = await withPlans(buildOpenAiNoTradeResult({
        analysisId,
        evidence,
        model,
        reason:
          `Snapshot validation status is ${snapshot.validation.status}; `
          + "evidence is not ready for directional OpenAI analysis.",
        newsResearchStatus,
      }), snapshot, tradeAllocation);
      await store.save(analysis, evidence);
      return {
        ok: true,
        code: "OK",
        error: null,
        latencyMs: Date.now() - started,
        analysis,
        evidence,
      };
    }

    const gate = getOpenAiInferenceGate();
    const chat = this.deps?.chat ?? openAiChatJson;

    try {
      const analysis = await withPlans(await gate.runExclusive(snapshotId, async () => {
        return this.runInference({
          analysisId,
          evidence,
          timeoutMs,
          model,
          apiKey: apiKey!,
          chat,
          newsResearchStatus,
        });
      }), snapshot, tradeAllocation);

      const authFailed = analysis.error && /authentication|API key/i.test(analysis.error);
      if (!authFailed && analysis.status === "completed") {
        await config.recordValidation(true);
      } else if (analysis.status === "failed" && authFailed) {
        await config.recordValidation(false);
      }

      await store.save(analysis, evidence);
      const ok = analysis.status === "completed" && !analysis.error;
      return {
        ok,
        code: ok ? "OK" : (analysis.error ? mapFailureCode(analysis) : "OK"),
        error: analysis.error,
        latencyMs: Date.now() - started,
        analysis,
        evidence,
      };
    } catch (err) {
      const code = (err as { code?: string })?.code === "AI_QUEUE_FULL"
        ? "AI_QUEUE_FULL"
        : "AI_ERROR";
      const message = err instanceof Error ? err.message.slice(0, 300) : "OpenAI inference failed.";
      const failed = await withPlans(buildOpenAiNoTradeResult({
        analysisId,
        evidence,
        model,
        reason: message,
        newsResearchStatus,
        status: "failed",
        error: message,
      }), snapshot, tradeAllocation);
      await store.save(failed, evidence);
      return {
        ok: false,
        code,
        error: message,
        latencyMs: Date.now() - started,
        analysis: failed,
        evidence,
      };
    }
  }

  private async runInference(input: {
    analysisId: string;
    evidence: ReturnType<typeof buildEvidenceFromSnapshot>;
    timeoutMs: number;
    model: string;
    apiKey: string;
    chat: ChatFn;
    newsResearchStatus: "unavailable";
  }): Promise<OpenAiSnapshotAnalysisResult> {
    const system = buildOpenAiSystemPrompt();
    const user = buildOpenAiUserPrompt(input.evidence);

    let generated = await input.chat({
      apiKey: input.apiKey,
      model: input.model,
      system,
      user,
      timeoutMs: input.timeoutMs,
      temperature: 0.1,
    });

    // No retry on auth/rate-limit. One bounded repair for invalid JSON/schema only.
    if (
      (!generated.ok || !generated.data)
      && generated.code === "OPENAI_INVALID_RESPONSE"
    ) {
      generated = await input.chat({
        apiKey: input.apiKey,
        model: input.model,
        system,
        user: buildOpenAiRepairPrompt(input.evidence),
        timeoutMs: Math.min(60_000, input.timeoutMs),
        temperature: 0,
      });
    }

    if (!generated.ok || !generated.data) {
      return buildOpenAiNoTradeResult({
        analysisId: input.analysisId,
        evidence: input.evidence,
        model: generated.model ?? input.model,
        reason: generated.error ?? "OpenAI generation failed.",
        inferenceLatencyMs: generated.latencyMs,
        newsResearchStatus: input.newsResearchStatus,
        status: "failed",
        error: generated.error ?? "OpenAI generation failed.",
      });
    }

    let normalized = normalizeOpenAiAnalysisFromModel({
      raw: generated.data,
      evidence: input.evidence,
      analysisId: input.analysisId,
      model: generated.model ?? input.model,
      inferenceLatencyMs: generated.latencyMs,
      newsResearchStatus: input.newsResearchStatus,
    });

    if (!normalized.ok) {
      const repair = await input.chat({
        apiKey: input.apiKey,
        model: input.model,
        system,
        user: buildOpenAiRepairPrompt(input.evidence),
        timeoutMs: Math.min(45_000, input.timeoutMs),
        temperature: 0,
      });
      if (repair.ok && repair.data) {
        normalized = normalizeOpenAiAnalysisFromModel({
          raw: repair.data,
          evidence: input.evidence,
          analysisId: input.analysisId,
          model: repair.model ?? input.model,
          inferenceLatencyMs: generated.latencyMs + repair.latencyMs,
          newsResearchStatus: input.newsResearchStatus,
        });
      }
    }

    if (!normalized.ok) {
      return buildOpenAiNoTradeResult({
        analysisId: input.analysisId,
        evidence: input.evidence,
        model: generated.model ?? input.model,
        reason: normalized.error,
        inferenceLatencyMs: generated.latencyMs,
        newsResearchStatus: input.newsResearchStatus,
        status: "failed",
        error: normalized.error,
      });
    }

    return normalized.analysis;
  }

  async getAnalysis(analysisId: string) {
    const store = this.deps?.store ?? getOpenAiSnapshotAnalysisStore();
    return store.get(analysisId);
  }

  async listBySnapshot(snapshotId: string, limit = 10) {
    const store = this.deps?.store ?? getOpenAiSnapshotAnalysisStore();
    return store.listBySnapshot(snapshotId, limit);
  }
}

function mapFailureCode(analysis: OpenAiSnapshotAnalysisResult): string {
  const err = analysis.error ?? "";
  if (/rate limit/i.test(err)) return "OPENAI_RATE_LIMIT";
  if (/auth/i.test(err) || /API key/i.test(err)) return "OPENAI_AUTH_ERROR";
  if (/timed out/i.test(err)) return "OPENAI_TIMEOUT";
  return "AI_ERROR";
}

let engineSingleton: OpenAiSnapshotAnalysisEngine | null = null;

export function getOpenAiSnapshotAnalysisEngine(): OpenAiSnapshotAnalysisEngine {
  engineSingleton ??= new OpenAiSnapshotAnalysisEngine();
  return engineSingleton;
}

export function createOpenAiSnapshotAnalysisEngine(
  deps?: ConstructorParameters<typeof OpenAiSnapshotAnalysisEngine>[0],
): OpenAiSnapshotAnalysisEngine {
  return new OpenAiSnapshotAnalysisEngine(deps);
}

export function resetOpenAiSnapshotAnalysisEngineForTests(): void {
  engineSingleton = null;
}

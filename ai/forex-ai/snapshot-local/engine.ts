/**
 * Phase 43D — Local AI analysis engine bound to an immutable market snapshot.
 */
import { randomUUID } from "node:crypto";
import {
  getOllamaAdapter,
  type StructuredGenerateResult,
} from "../../ai-provider/ollama-adapter.js";
import { isSmallReasoningModel } from "../../ai-provider/ollama-client.js";
import {
  buildAnalysisSnapshotFingerprintPayload,
  fingerprintAnalysisSnapshotPayload,
  getAnalysisSnapshotEngine,
} from "../../market-data/analysis-snapshot/index.js";
import type { AnalysisMarketSnapshot } from "../../market-data/analysis-snapshot/types.js";
import { parseMarketProviderId } from "../../market-data/providers/identity.js";
import { parseCanonicalTimeframe } from "../../market-data/providers/contracts.js";
import { parseAnalysisPeriodId } from "../../market-data/analysis-snapshot/periods.js";
import { enrichAnalysisWithPositionRisk } from "../position-sizing/index.js";
import { attachPlanBundleToAnalysis } from "../snapshot-plans/index.js";
import { getLocalAiInferenceGate } from "./concurrency.js";
import { buildEvidenceFromSnapshot } from "./evidence-from-snapshot.js";
import {
  buildLocalSnapshotAnalysisPrompt,
  buildLocalSnapshotRepairPrompt,
} from "./prompts.js";
import { getLocalSnapshotAnalysisStore, type LocalSnapshotAnalysisStore } from "./store.js";
import {
  buildNoTradeResult,
  normalizeLocalAnalysisFromModel,
} from "./validate-result.js";
import type {
  LocalSnapshotAnalysisApiResult,
  LocalSnapshotAnalysisRequest,
  LocalSnapshotAnalysisResult,
} from "./types.js";

async function withPlans(
  analysis: LocalSnapshotAnalysisResult,
  snapshot: AnalysisMarketSnapshot,
): Promise<LocalSnapshotAnalysisResult> {
  const planned = attachPlanBundleToAnalysis(analysis, snapshot, "LOCAL");
  return enrichAnalysisWithPositionRisk(planned, snapshot);
}

export const LOCAL_AI_DEFAULT_TIMEOUT_MS = 120_000;
export const LOCAL_AI_MIN_TIMEOUT_MS = 20_000;
export const LOCAL_AI_MAX_TIMEOUT_MS = 180_000;

function clampTimeout(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : LOCAL_AI_DEFAULT_TIMEOUT_MS;
  return Math.max(LOCAL_AI_MIN_TIMEOUT_MS, Math.min(LOCAL_AI_MAX_TIMEOUT_MS, Math.floor(n)));
}

export function verifySnapshotFingerprint(snapshot: AnalysisMarketSnapshot): boolean {
  const draft = {
    schemaVersion: snapshot.schemaVersion,
    provider: snapshot.provider,
    instrument: snapshot.instrument,
    environment: snapshot.environment,
    priceBasis: snapshot.priceBasis,
    candleTimeframe: snapshot.candleTimeframe,
    analysisPeriod: snapshot.analysisPeriod,
    requestedRange: snapshot.requestedRange,
    returnedRange: snapshot.returnedRange,
    candleCount: snapshot.candleCount,
    candlesRequestedEstimate: snapshot.candlesRequestedEstimate,
    candles: snapshot.candles,
    latestQuote: snapshot.latestQuote,
    marketStatus: snapshot.marketStatus,
    freshness: snapshot.freshness,
    validation: snapshot.validation,
    dataGaps: snapshot.dataGaps,
    sourceMetadata: snapshot.sourceMetadata,
    warnings: snapshot.warnings,
    evidenceReady: snapshot.evidenceReady,
  };
  const expected = fingerprintAnalysisSnapshotPayload(
    buildAnalysisSnapshotFingerprintPayload(draft),
  );
  return expected === snapshot.contentFingerprint;
}

function fail(
  started: number,
  code: string,
  error: string,
): LocalSnapshotAnalysisApiResult {
  return {
    ok: false,
    code,
    error,
    latencyMs: Date.now() - started,
    analysis: null,
    evidence: null,
  };
}

type GenerateStructuredFn = (input: {
  prompt: string;
  timeoutMs?: number;
  options?: Record<string, unknown>;
}) => Promise<StructuredGenerateResult>;

export class LocalSnapshotAnalysisEngine {
  constructor(
    private readonly deps?: {
      getSnapshot?: (id: string) => Promise<AnalysisMarketSnapshot | null>;
      store?: LocalSnapshotAnalysisStore;
      generateStructured?: GenerateStructuredFn;
    },
  ) {}

  private async loadSnapshot(id: string): Promise<AnalysisMarketSnapshot | null> {
    if (this.deps?.getSnapshot) return this.deps.getSnapshot(id);
    return getAnalysisSnapshotEngine().getSnapshot(id);
  }

  async analyze(raw: LocalSnapshotAnalysisRequest): Promise<LocalSnapshotAnalysisApiResult> {
    const started = Date.now();
    const snapshotId = String(raw.snapshotId ?? "").trim();
    if (!snapshotId) {
      return fail(started, "INVALID_REQUEST", "snapshotId is required.");
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
    const store = this.deps?.store ?? getLocalSnapshotAnalysisStore();

    // Unusable snapshot → structured NO_TRADE without calling the model.
    if (!snapshot.evidenceReady) {
      const analysis = await withPlans(buildNoTradeResult({
        analysisId,
        evidence,
        model: null,
        reason:
          `Snapshot validation status is ${snapshot.validation.status}; `
          + "evidence is not ready for directional Local AI analysis.",
      }), snapshot);
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

    const gate = getLocalAiInferenceGate();
    try {
      const analysis = await withPlans(await gate.runExclusive(snapshotId, async () => {
        return this.runInference({
          analysisId,
          evidence,
          timeoutMs,
        });
      }), snapshot);
      await store.save(analysis, evidence);
      const ok = analysis.status === "completed" && !analysis.error;
      return {
        ok,
        code: ok ? "OK" : (analysis.error ? "AI_ERROR" : "OK"),
        error: analysis.error,
        latencyMs: Date.now() - started,
        analysis,
        evidence,
      };
    } catch (err) {
      const code = (err as { code?: string })?.code === "AI_QUEUE_FULL"
        ? "AI_QUEUE_FULL"
        : "AI_ERROR";
      const message = err instanceof Error ? err.message.slice(0, 300) : "Local AI inference failed.";
      const failed: LocalSnapshotAnalysisResult = await withPlans({
        ...buildNoTradeResult({
          analysisId,
          evidence,
          model: null,
          reason: message,
        }),
        status: "failed",
        decision: "NO_TRADE",
        error: message,
      }, snapshot);
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
  }): Promise<LocalSnapshotAnalysisResult> {
    const adapter = getOllamaAdapter();
    const generate = this.deps?.generateStructured?.bind(adapter)
      ?? adapter.generateStructured.bind(adapter);

    const prompt = buildLocalSnapshotAnalysisPrompt(input.evidence);
    const genOptions = {
      temperature: 0.1,
      num_ctx: 2048,
      num_predict: 280,
    } as const;

    const inferenceStarted = Date.now();
    let generated = await generate({
      prompt,
      timeoutMs: input.timeoutMs,
      options: { ...genOptions },
    });

    if (
      (!generated.ok || !generated.data)
      && generated.code === "OLLAMA_INVALID_RESPONSE"
      && generated.model
      && isSmallReasoningModel(generated.model)
    ) {
      generated = await generate({
        prompt: buildLocalSnapshotRepairPrompt(input.evidence),
        timeoutMs: Math.min(90_000, input.timeoutMs),
        options: { temperature: 0, num_ctx: 1536, num_predict: 220 },
      });
    }
    const inferenceLatencyMs = Date.now() - inferenceStarted;

    if (!generated.ok || !generated.data) {
      const reason = generated.code === "OLLAMA_TIMEOUT"
        ? `Local AI timed out after ${inferenceLatencyMs} ms.`
        : (generated.error ?? "Local AI generation failed.");
      const analysis = buildNoTradeResult({
        analysisId: input.analysisId,
        evidence: input.evidence,
        model: generated.model,
        reason,
        inferenceLatencyMs,
      });
      return {
        ...analysis,
        status: "failed",
        error: reason,
        decision: generated.code === "OLLAMA_TIMEOUT" ? "WAIT" : "NO_TRADE",
      };
    }

    let normalized = normalizeLocalAnalysisFromModel({
      raw: generated.data,
      evidence: input.evidence,
      analysisId: input.analysisId,
      model: generated.model,
      inferenceLatencyMs,
    });

    // One bounded schema-repair attempt when JSON parsed but contract fields were incomplete.
    if (!normalized.ok && generated.model && isSmallReasoningModel(generated.model)) {
      const repairStarted = Date.now();
      const repaired = await generate({
        prompt: buildLocalSnapshotRepairPrompt(input.evidence),
        timeoutMs: Math.min(60_000, input.timeoutMs),
        options: { temperature: 0, num_ctx: 1536, num_predict: 220 },
      });
      const repairLatency = inferenceLatencyMs + (Date.now() - repairStarted);
      if (repaired.ok && repaired.data) {
        normalized = normalizeLocalAnalysisFromModel({
          raw: repaired.data,
          evidence: input.evidence,
          analysisId: input.analysisId,
          model: repaired.model ?? generated.model,
          inferenceLatencyMs: repairLatency,
        });
      }
    }

    if (!normalized.ok) {
      return {
        ...buildNoTradeResult({
          analysisId: input.analysisId,
          evidence: input.evidence,
          model: generated.model,
          reason: normalized.error,
          inferenceLatencyMs,
        }),
        status: "failed",
        error: normalized.error,
      };
    }

    return normalized.analysis;
  }

  async getAnalysis(analysisId: string) {
    const store = this.deps?.store ?? getLocalSnapshotAnalysisStore();
    return store.get(analysisId);
  }

  async listBySnapshot(snapshotId: string, limit = 10) {
    const store = this.deps?.store ?? getLocalSnapshotAnalysisStore();
    return store.listBySnapshot(snapshotId, limit);
  }
}

let engineSingleton: LocalSnapshotAnalysisEngine | null = null;

export function getLocalSnapshotAnalysisEngine(): LocalSnapshotAnalysisEngine {
  engineSingleton ??= new LocalSnapshotAnalysisEngine();
  return engineSingleton;
}

export function createLocalSnapshotAnalysisEngine(
  deps?: ConstructorParameters<typeof LocalSnapshotAnalysisEngine>[0],
): LocalSnapshotAnalysisEngine {
  return new LocalSnapshotAnalysisEngine(deps);
}

export function resetLocalSnapshotAnalysisEngineForTests(): void {
  engineSingleton = null;
}

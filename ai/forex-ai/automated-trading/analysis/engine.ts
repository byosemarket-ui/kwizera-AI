/**
 * Phase 53 — Independent OpenAI technical analysis engine for Automated Trading.
 * Uses existing Forex OpenAI config + client. Never falls back to Local AI.
 * Never places broker orders.
 */
import { randomUUID } from "node:crypto";
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import {
  getForexOpenAiConfigStore,
  type ForexOpenAiConfigStore,
} from "../../snapshot-openai/config-store.js";
import { getOpenAiInferenceGate } from "../../snapshot-openai/concurrency.js";
import { isOpenAiChatEligibleModel } from "../../snapshot-openai/model-policy.js";
import { openAiChatJson } from "../../snapshot-openai/openai-client.js";
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AutomatedTradingVerificationResult } from "../verification-types.js";
import {
  AT_DEFAULT_TIMEFRAMES,
  buildEvidenceBundle,
  evidenceForModelPrompt,
  type AtRawCandle,
} from "./evidence.js";
import { buildAtOpenAiSystemPrompt, buildAtOpenAiUserPrompt } from "./prompts.js";
import { getAtOpenAiAnalysisStore, type AtOpenAiAnalysisStore } from "./store.js";
import type {
  AtOpenAiAnalysisPublicStatus,
  AtOpenAiAnalysisResult,
} from "./types.js";
import {
  AT_CONFIDENCE_LABEL,
  AT_OPENAI_ANALYSIS_PHASE,
  AT_OPENAI_ANALYSIS_SCHEMA,
} from "./types.js";
import { markStaleIfFingerprintMismatch, normalizeAtOpenAiAnalysis } from "./validate.js";

export const AT_OPENAI_DEFAULT_TIMEOUT_MS = 90_000;
export const AT_OPENAI_MIN_TIMEOUT_MS = 15_000;
export const AT_OPENAI_MAX_TIMEOUT_MS = 180_000;

function clampTimeout(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : AT_OPENAI_DEFAULT_TIMEOUT_MS;
  return Math.max(AT_OPENAI_MIN_TIMEOUT_MS, Math.min(AT_OPENAI_MAX_TIMEOUT_MS, Math.floor(n)));
}

function mapCandles(raw: unknown): AtRawCandle[] {
  if (!Array.isArray(raw)) return [];
  const out: AtRawCandle[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const open = Number(o.open);
    const high = Number(o.high);
    const low = Number(o.low);
    const close = Number(o.close);
    if (![open, high, low, close].every((x) => Number.isFinite(x))) continue;
    const time = (o.time ?? o.timestamp ?? o.t) as number | string;
    out.push({ time, open, high, low, close });
  }
  return out;
}

export class AtOpenAiAnalysisEngine {
  private inFlight = false;
  private readonly boundStore: AtOpenAiAnalysisStore;

  constructor(
    private readonly deps?: {
      config?: ForexOpenAiConfigStore;
      store?: AtOpenAiAnalysisStore;
      chat?: typeof openAiChatJson;
      loadCandles?: (
        symbol: string,
        timeframe: string,
      ) => Promise<AtRawCandle[]>;
      storageRoot?: string;
    },
  ) {
    this.boundStore = deps?.store ?? getAtOpenAiAnalysisStore(deps?.storageRoot);
  }

  private config(): ForexOpenAiConfigStore {
    return this.deps?.config ?? getForexOpenAiConfigStore();
  }

  private store(): AtOpenAiAnalysisStore {
    return this.boundStore;
  }

  private chat(): typeof openAiChatJson {
    return this.deps?.chat ?? openAiChatJson;
  }

  async providerStatus(): Promise<AtOpenAiAnalysisPublicStatus> {
    const cfg = this.config();
    const pub = await cfg.getPublicStatus();
    const latest = this.store().latest();
    return {
      provider: "OPENAI",
      modelConfigured: pub.model ?? null,
      apiKeyConfigured: Boolean(pub.configured),
      latest,
      historyCount: this.store().count(),
      inFlight: this.inFlight,
      placesOrders: false,
    };
  }

  getLatest(): AtOpenAiAnalysisResult | null {
    return this.store().latest();
  }

  getById(id: string): AtOpenAiAnalysisResult | null {
    return this.store().get(id);
  }

  listHistory(limit = 12): AtOpenAiAnalysisResult[] {
    return this.store().list(limit);
  }

  private async loadCandles(symbol: string, timeframe: string): Promise<AtRawCandle[]> {
    if (this.deps?.loadCandles) return this.deps.loadCandles(symbol, timeframe);
    const bridge = getForexConnectBridge();
    const res = await bridge.getHistoricalCandles({ symbol, timeframe, limit: 120 });
    return mapCandles(res.candles);
  }

  async analyze(input: {
    environment: AutomatedTradingEnvironment;
    environmentEpoch: number;
    instrument: string;
    timeframes?: string[];
    verification: AutomatedTradingVerificationResult | null;
    timeoutMs?: unknown;
  }): Promise<
    | { ok: true; analysis: AtOpenAiAnalysisResult }
    | { ok: false; code: string; message: string; analysis: AtOpenAiAnalysisResult | null }
  > {
    const started = Date.now();
    const instrument = String(input.instrument ?? "").trim();
    if (!instrument) {
      return {
        ok: false,
        code: "INSTRUMENT_NOT_SELECTED",
        message: "Select a ForexConnect instrument before running OpenAI analysis.",
        analysis: null,
      };
    }

    // No Local AI fallback — OpenAI only.
    const cfg = this.config();
    const pub = await cfg.getPublicStatus();
    const model = String(pub.model ?? "").trim();
    if (!pub.configured) {
      return {
        ok: false,
        code: "OPENAI_NOT_CONFIGURED",
        message: "OpenAI API key is not configured in Forex Admin.",
        analysis: null,
      };
    }
    if (!model || !isOpenAiChatEligibleModel(model)) {
      return {
        ok: false,
        code: "OPENAI_MODEL_INVALID",
        message: "Configured OpenAI model is missing or not chat-eligible.",
        analysis: null,
      };
    }
    const apiKey = await cfg.getApiKey();
    if (!apiKey) {
      return {
        ok: false,
        code: "OPENAI_NOT_CONFIGURED",
        message: "OpenAI API key could not be decrypted.",
        analysis: null,
      };
    }

    if (this.inFlight) {
      return {
        ok: false,
        code: "ANALYSIS_IN_FLIGHT",
        message: "An OpenAI analysis is already running. Wait for it to finish.",
        analysis: null,
      };
    }

    const timeframes = (input.timeframes?.length
      ? input.timeframes
      : [...AT_DEFAULT_TIMEFRAMES]
    ).map((t) => String(t).trim()).filter(Boolean).slice(0, 6);

    this.inFlight = true;
    try {
      const candlesByTf: Record<string, AtRawCandle[]> = {};
      for (const tf of timeframes) {
        try {
          candlesByTf[tf] = await this.loadCandles(instrument, tf);
        } catch (err) {
          candlesByTf[tf] = [];
          // Keep going; evidence builder will report insufficiency.
          void err;
        }
      }

      const evidenceBuild = buildEvidenceBundle({
        environment: input.environment,
        instrument,
        candlesByTf,
        verification: input.verification,
      });
      if (!evidenceBuild.ok || !evidenceBuild.evidence) {
        const failed: AtOpenAiAnalysisResult = {
          schemaVersion: AT_OPENAI_ANALYSIS_SCHEMA,
          phase: AT_OPENAI_ANALYSIS_PHASE,
          analysisId: randomUUID(),
          lifecycle: "DATA_INSUFFICIENT",
          environment: input.environment,
          environmentEpoch: input.environmentEpoch,
          instrument,
          timeframes,
          inputFingerprint: evidenceBuild.evidence?.fingerprint ?? "none",
          provider: "OPENAI",
          modelRequested: model,
          modelUsed: null,
          directionalBias: "UNKNOWN",
          trendState: "UNKNOWN",
          trendStrength: "UNKNOWN",
          mtfAgreement: "INSUFFICIENT",
          keyEvidence: [],
          counterEvidence: [],
          supportLevels: [],
          resistanceLevels: [],
          patterns: [],
          structureNotes: [],
          scenarios: [],
          explanation: evidenceBuild.message,
          dataQuality: "INSUFFICIENT",
          limitations: [evidenceBuild.message],
          blockers: [{ code: evidenceBuild.code, message: evidenceBuild.message }],
          confidenceLabel: AT_CONFIDENCE_LABEL,
          evidenceScoreIsWinProbability: false,
          createdAtUtc: new Date().toISOString(),
          latencyMs: Date.now() - started,
          placesOrders: false,
          historicalOnly: true,
        };
        await this.store().save(failed);
        return { ok: false, code: evidenceBuild.code, message: evidenceBuild.message, analysis: failed };
      }

      const evidence = evidenceBuild.evidence;
      const gate = getOpenAiInferenceGate();
      const timeoutMs = clampTimeout(input.timeoutMs);
      const payload = evidenceForModelPrompt(evidence, candlesByTf);

      const chatResult = await gate.runExclusive(`at-ta:${evidence.fingerprint}`, () =>
        this.chat()({
          apiKey,
          model,
          system: buildAtOpenAiSystemPrompt(),
          user: buildAtOpenAiUserPrompt(payload),
          timeoutMs,
          temperature: 0.1,
        }),
      );

      if (!chatResult.ok || !chatResult.data) {
        const failed: AtOpenAiAnalysisResult = {
          schemaVersion: AT_OPENAI_ANALYSIS_SCHEMA,
          phase: AT_OPENAI_ANALYSIS_PHASE,
          analysisId: randomUUID(),
          lifecycle: "ANALYSIS_FAILED",
          environment: input.environment,
          environmentEpoch: input.environmentEpoch,
          instrument,
          timeframes,
          inputFingerprint: evidence.fingerprint,
          provider: "OPENAI",
          modelRequested: model,
          modelUsed: chatResult.model,
          directionalBias: "UNKNOWN",
          trendState: "UNKNOWN",
          trendStrength: "UNKNOWN",
          mtfAgreement: "UNKNOWN",
          keyEvidence: [],
          counterEvidence: [],
          supportLevels: [],
          resistanceLevels: [],
          patterns: [],
          structureNotes: [],
          scenarios: [],
          explanation: chatResult.error ?? "OpenAI analysis failed.",
          dataQuality: evidence.historicalOnly ? "HISTORICAL_ONLY" : "PARTIAL",
          limitations: [chatResult.error ?? "provider error"],
          blockers: [{
            code: chatResult.code,
            message: chatResult.error ?? "OpenAI analysis failed.",
          }],
          confidenceLabel: AT_CONFIDENCE_LABEL,
          evidenceScoreIsWinProbability: false,
          createdAtUtc: new Date().toISOString(),
          latencyMs: Date.now() - started,
          placesOrders: false,
          historicalOnly: evidence.historicalOnly,
        };
        await this.store().save(failed);
        return {
          ok: false,
          code: chatResult.code,
          message: chatResult.error ?? "OpenAI analysis failed.",
          analysis: failed,
        };
      }

      const { result } = normalizeAtOpenAiAnalysis({
        analysisId: randomUUID(),
        raw: chatResult.data,
        environment: input.environment,
        environmentEpoch: input.environmentEpoch,
        instrument,
        timeframes,
        inputFingerprint: evidence.fingerprint,
        modelRequested: model,
        modelUsed: chatResult.model,
        candlesByTf,
        historicalOnly: evidence.historicalOnly,
        createdAtUtc: new Date().toISOString(),
        latencyMs: Date.now() - started,
      });

      await this.store().save(result);
      return { ok: true, analysis: result };
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 200) : "Analysis failed.";
      const code = (err as { code?: string })?.code === "AI_QUEUE_FULL"
        ? "AI_QUEUE_FULL"
        : "ANALYSIS_FAILED";
      return { ok: false, code, message, analysis: null };
    } finally {
      this.inFlight = false;
    }
  }

  refreshStale(currentFingerprint: string | null): AtOpenAiAnalysisResult | null {
    const latest = this.store().latest();
    if (!latest) return null;
    return markStaleIfFingerprintMismatch(latest, currentFingerprint);
  }
}

let engineSingleton: AtOpenAiAnalysisEngine | null = null;

export function getAtOpenAiAnalysisEngine(storageRoot?: string): AtOpenAiAnalysisEngine {
  if (storageRoot) return new AtOpenAiAnalysisEngine({ storageRoot });
  if (!engineSingleton) engineSingleton = new AtOpenAiAnalysisEngine();
  return engineSingleton;
}

export function resetAtOpenAiAnalysisEngineForTests(): void {
  engineSingleton = null;
}

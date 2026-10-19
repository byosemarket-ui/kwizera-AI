/**
 * Phase 53 / 53.1 / 53.3 — Independent OpenAI technical analysis engine for Automated Trading.
 * Uses existing Forex OpenAI config + client. Never falls back to Local AI.
 * Never places broker orders. Monitor analyses require chart image inclusion.
 */
import { randomUUID } from "node:crypto";
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import {
  getForexOpenAiConfigStore,
  type ForexOpenAiConfigStore,
} from "../../snapshot-openai/config-store.js";
import { getOpenAiInferenceGate } from "../../snapshot-openai/concurrency.js";
import { isOpenAiChatEligibleModel } from "../../snapshot-openai/model-policy.js";
import {
  openAiChatJson,
  openAiChatMultimodalJson,
} from "../../snapshot-openai/openai-client.js";
import { isOpenAiVisionEligibleModel } from "../../multi-image-openai/vision-policy.js";
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AutomatedTradingVerificationResult } from "../verification-types.js";
import {
  AT_DEFAULT_TIMEFRAMES,
  buildEvidenceBundle,
  evidenceForModelPrompt,
  type AtRawCandle,
} from "./evidence.js";
import { resolveAtForecastHorizon } from "./direction.js";
import { buildAtOpenAiSystemPrompt, buildAtOpenAiUserPrompt } from "./prompts.js";
import { getAtOpenAiAnalysisStore, type AtOpenAiAnalysisStore } from "./store.js";
import type {
  AtChartImageMeta,
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

/** Map legacy FC period labels used in Phase 53 defaults to project timeframe IDs. */
function toProjectTimeframe(tf: string): string {
  const aliases: Record<string, string> = {
    m1: "1m",
    M1: "1m",
    m5: "5m",
    M5: "5m",
    m15: "15m",
    M15: "15m",
    m30: "30m",
    M30: "30m",
    H1: "1h",
    h1: "1h",
    H4: "4h",
    h4: "4h",
    D1: "1d",
    W1: "1w",
  };
  return aliases[tf] ?? tf;
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

function baseFailed(input: {
  analysisId: string;
  environment: AutomatedTradingEnvironment;
  environmentEpoch: number;
  instrument: string;
  timeframes: string[];
  primaryTimeframe: string | null;
  fingerprint: string;
  model: string;
  modelUsed: string | null;
  visionEligible: boolean;
  trigger: "scheduled" | "manual" | "legacy";
  monitorConfigEpoch: number | null;
  chartImage: AtChartImageMeta | null;
  lifecycle: AtOpenAiAnalysisResult["lifecycle"];
  message: string;
  code: string;
  historicalOnly: boolean;
  dataQuality: AtOpenAiAnalysisResult["dataQuality"];
  started: number;
}): AtOpenAiAnalysisResult {
  return {
    schemaVersion: AT_OPENAI_ANALYSIS_SCHEMA,
    phase: AT_OPENAI_ANALYSIS_PHASE,
    analysisId: input.analysisId,
    lifecycle: input.lifecycle,
    environment: input.environment,
    environmentEpoch: input.environmentEpoch,
    instrument: input.instrument,
    timeframes: input.timeframes,
    primaryTimeframe: input.primaryTimeframe,
    inputFingerprint: input.fingerprint,
    provider: "OPENAI",
    modelRequested: input.model,
    modelUsed: input.modelUsed,
    modelVisionEligible: input.visionEligible,
    trigger: input.trigger,
    monitorConfigEpoch: input.monitorConfigEpoch,
    chartImage: input.chartImage,
    direction: null,
    directionalConfidencePct: null,
    directionalConfidenceNote: "Estimated directional confidence — NOT CALIBRATED",
    forecastHorizon: null,
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
    explanation: input.message,
    dataQuality: input.dataQuality,
    limitations: [input.message],
    blockers: [{ code: input.code, message: input.message }],
    confidenceLabel: AT_CONFIDENCE_LABEL,
    evidenceScoreIsWinProbability: false,
    createdAtUtc: new Date().toISOString(),
    latencyMs: Date.now() - input.started,
    placesOrders: false,
    historicalOnly: input.historicalOnly,
    liveLabeled: false,
  };
}

export class AtOpenAiAnalysisEngine {
  private inFlight = false;
  private readonly boundStore: AtOpenAiAnalysisStore;
  /** Fingerprint of the newest successful analysis — reject out-of-order overwrites. */
  private latestSuccessFingerprint: string | null = null;
  private latestSuccessAtMs = 0;

  constructor(
    private readonly deps?: {
      config?: ForexOpenAiConfigStore;
      store?: AtOpenAiAnalysisStore;
      chat?: typeof openAiChatJson;
      chatMultimodal?: typeof openAiChatMultimodalJson;
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

  private chatMultimodal(): typeof openAiChatMultimodalJson {
    return this.deps?.chatMultimodal ?? openAiChatMultimodalJson;
  }

  async providerStatus(): Promise<AtOpenAiAnalysisPublicStatus> {
    const cfg = this.config();
    const pub = await cfg.getPublicStatus();
    const latest = this.store().latest();
    const model = String(pub.model ?? "").trim();
    return {
      provider: "OPENAI",
      modelConfigured: pub.model ?? null,
      apiKeyConfigured: Boolean(pub.configured),
      modelVisionEligible: model ? isOpenAiVisionEligibleModel(model) : false,
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
    const res = await bridge.getHistoricalCandles({
      symbol,
      timeframe: toProjectTimeframe(timeframe),
      limit: 120,
    });
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
    return this.analyzeWithChart({
      ...input,
      primaryTimeframe: input.timeframes?.[0] ?? null,
      trigger: "manual",
      monitorConfigEpoch: null,
      chartImage: null,
      requireImage: false,
    });
  }

  async analyzeWithChart(input: {
    environment: AutomatedTradingEnvironment;
    environmentEpoch: number;
    instrument: string;
    primaryTimeframe?: string | null;
    timeframes?: string[];
    verification: AutomatedTradingVerificationResult | null;
    timeoutMs?: unknown;
    trigger: "scheduled" | "manual" | "legacy";
    monitorConfigEpoch: number | null;
    chartImage: {
      mimeType: "image/png";
      base64: string;
      meta: Omit<AtChartImageMeta, "includedInOpenAiRequest">;
    } | null;
    requireImage: boolean;
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
    const visionEligible = model ? isOpenAiVisionEligibleModel(model) : false;

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

    const hasImageBytes = Boolean(input.chartImage?.base64?.trim());
    const wantsImage = hasImageBytes || input.requireImage;
    if (wantsImage && !visionEligible) {
      return {
        ok: false,
        code: "MODEL_NOT_VISION_ELIGIBLE",
        message:
          `Configured model "${model}" is not eligible for image inputs. `
          + "Select a vision-capable model in Forex Admin. Chart was not silently dropped.",
        analysis: null,
      };
    }
    if (input.requireImage && !hasImageBytes) {
      return {
        ok: false,
        code: "IMAGE_UNAVAILABLE",
        message:
          input.chartImage?.meta?.note
          || "Chart image required for monitoring analysis but was unavailable. Text-only OpenAI was not used.",
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
    ).map((t) => toProjectTimeframe(String(t).trim())).filter(Boolean).slice(0, 6);
    const primaryTimeframe = input.primaryTimeframe
      ? toProjectTimeframe(input.primaryTimeframe)
      : timeframes[0] ?? null;

    this.inFlight = true;
    try {
      const candlesByTf: Record<string, AtRawCandle[]> = {};
      for (const tf of timeframes) {
        try {
          candlesByTf[tf] = await this.loadCandles(instrument, tf);
        } catch {
          candlesByTf[tf] = [];
        }
      }

      const evidenceBuild = buildEvidenceBundle({
        environment: input.environment,
        instrument,
        candlesByTf,
        verification: input.verification,
      });

      const chartMeta: AtChartImageMeta | null = input.chartImage
        ? {
            ...input.chartImage.meta,
            includedInOpenAiRequest: false,
            marketDataFingerprint: input.chartImage.meta.marketDataFingerprint ?? null,
          }
        : {
            available: false,
            imageHash: null,
            capturedAtUtc: null,
            source: "none",
            note: "No chart image supplied for this analysis.",
            blocker: input.requireImage ? "IMAGE_UNAVAILABLE" : null,
            includedInOpenAiRequest: false,
            marketDataFingerprint: null,
          };

      if (!evidenceBuild.ok || !evidenceBuild.evidence) {
        const failed = baseFailed({
          analysisId: randomUUID(),
          environment: input.environment,
          environmentEpoch: input.environmentEpoch,
          instrument,
          timeframes,
          primaryTimeframe,
          fingerprint: evidenceBuild.evidence?.fingerprint ?? "none",
          model,
          modelUsed: null,
          visionEligible,
          trigger: input.trigger,
          monitorConfigEpoch: input.monitorConfigEpoch,
          chartImage: chartMeta,
          lifecycle: "DATA_INSUFFICIENT",
          message: evidenceBuild.message,
          code: evidenceBuild.code,
          historicalOnly: true,
          dataQuality: "INSUFFICIENT",
          started,
        });
        await this.store().save(failed);
        return { ok: false, code: evidenceBuild.code, message: evidenceBuild.message, analysis: failed };
      }

      const evidence = evidenceBuild.evidence;
      if (chartMeta) {
        chartMeta.marketDataFingerprint = chartMeta.marketDataFingerprint ?? evidence.fingerprint;
        const primarySummary = evidence.candles.find((c) => c.timeframe === primaryTimeframe)
          ?? evidence.candles[0];
        chartMeta.evidenceWindowStartUtc = primarySummary?.firstTimeUtc ?? null;
        chartMeta.evidenceWindowEndUtc = primarySummary?.lastTimeUtc ?? null;
      }

      const gate = getOpenAiInferenceGate();
      const timeoutMs = clampTimeout(input.timeoutMs);
      const horizon = resolveAtForecastHorizon(primaryTimeframe);
      const payload = {
        ...evidenceForModelPrompt(evidence, candlesByTf),
        primaryTimeframe,
        forecastHorizon: horizon.ok ? horizon.forecastHorizon : null,
        forecastHorizonPolicy: horizon.ok
          ? "Next one candle close of the primary timeframe after observation."
          : horizon.message,
        trigger: input.trigger,
        chartImageMeta: chartMeta
          ? {
              available: chartMeta.available,
              imageHash: chartMeta.imageHash,
              capturedAtUtc: chartMeta.capturedAtUtc,
              source: chartMeta.source,
              note: chartMeta.note,
              includedInOpenAiRequest: false,
              marketDataFingerprint: chartMeta.marketDataFingerprint ?? null,
              evidenceWindowStartUtc: chartMeta.evidenceWindowStartUtc ?? null,
              evidenceWindowEndUtc: chartMeta.evidenceWindowEndUtc ?? null,
            }
          : null,
        binaryDirectionRequirement: "Successful predictions must set direction to BUY or SELL only.",
      };

      // Multimodal only when real image bytes are present and the model is vision-eligible.
      // Never claim includedInOpenAiRequest until the multimodal call succeeds.
      // Phase 53.3 — monitor paths set requireImage: never silently fall back to text-only.
      const useMultimodal = hasImageBytes && visionEligible && Boolean(input.chartImage);
      if (input.requireImage && !useMultimodal) {
        const failed = baseFailed({
          analysisId: randomUUID(),
          environment: input.environment,
          environmentEpoch: input.environmentEpoch,
          instrument,
          timeframes,
          primaryTimeframe,
          fingerprint: evidence.fingerprint,
          model,
          modelUsed: null,
          visionEligible,
          trigger: input.trigger,
          monitorConfigEpoch: input.monitorConfigEpoch,
          chartImage: chartMeta,
          lifecycle: "ANALYSIS_FAILED",
          message:
            "Chart image required but multimodal request could not be formed. Text-only OpenAI was not used.",
          code: "IMAGE_UNAVAILABLE",
          historicalOnly: evidence.historicalOnly,
          dataQuality: evidence.historicalOnly ? "HISTORICAL_ONLY" : "PARTIAL",
          started,
        });
        await this.store().save(failed);
        return {
          ok: false,
          code: "IMAGE_UNAVAILABLE",
          message: failed.explanation,
          analysis: failed,
        };
      }

      const chatResult = await gate.runExclusive(`at-ta:${evidence.fingerprint}:${input.trigger}`, () => {
        if (useMultimodal && input.chartImage) {
          return this.chatMultimodal()({
            apiKey,
            model,
            system: buildAtOpenAiSystemPrompt({ withChartImage: true }),
            userText: buildAtOpenAiUserPrompt(payload),
            images: [{ mimeType: input.chartImage.mimeType, base64: input.chartImage.base64 }],
            timeoutMs,
            temperature: 0.1,
          });
        }
        return this.chat()({
          apiKey,
          model,
          system: buildAtOpenAiSystemPrompt({ withChartImage: false }),
          user: buildAtOpenAiUserPrompt(payload),
          timeoutMs,
          temperature: 0.1,
        });
      });

      if (!chatResult.ok || !chatResult.data) {
        if (chartMeta) chartMeta.includedInOpenAiRequest = false;
        const failed = baseFailed({
          analysisId: randomUUID(),
          environment: input.environment,
          environmentEpoch: input.environmentEpoch,
          instrument,
          timeframes,
          primaryTimeframe,
          fingerprint: evidence.fingerprint,
          model,
          modelUsed: chatResult.model,
          visionEligible,
          trigger: input.trigger,
          monitorConfigEpoch: input.monitorConfigEpoch,
          chartImage: chartMeta,
          lifecycle: "ANALYSIS_FAILED",
          message: chatResult.error ?? "OpenAI analysis failed.",
          code: chatResult.code,
          historicalOnly: evidence.historicalOnly,
          dataQuality: evidence.historicalOnly ? "HISTORICAL_ONLY" : "PARTIAL",
          started,
        });
        await this.store().save(failed);
        return {
          ok: false,
          code: chatResult.code,
          message: chatResult.error ?? "OpenAI analysis failed.",
          analysis: failed,
        };
      }

      // Image was in the successful multimodal request body only when useMultimodal was true.
      if (chartMeta) chartMeta.includedInOpenAiRequest = useMultimodal;

      const { result } = normalizeAtOpenAiAnalysis({
        analysisId: randomUUID(),
        raw: chatResult.data,
        environment: input.environment,
        environmentEpoch: input.environmentEpoch,
        instrument,
        timeframes,
        primaryTimeframe,
        inputFingerprint: evidence.fingerprint,
        modelRequested: model,
        modelUsed: chatResult.model,
        modelVisionEligible: visionEligible,
        trigger: input.trigger,
        monitorConfigEpoch: input.monitorConfigEpoch,
        chartImage: chartMeta,
        candlesByTf,
        historicalOnly: evidence.historicalOnly,
        createdAtUtc: new Date().toISOString(),
        latencyMs: Date.now() - started,
      });

      // Stale / out-of-order guard: do not let an older fingerprint become "latest"
      // if a newer successful analysis already landed.
      if (
        this.latestSuccessFingerprint
        && this.latestSuccessAtMs > started
        && result.inputFingerprint !== this.latestSuccessFingerprint
      ) {
        const stale = {
          ...result,
          lifecycle: "STALE_RESULT" as const,
          blockers: [
            ...result.blockers,
            {
              code: "OUT_OF_ORDER_RESULT",
              message: "Result completed after a newer analysis — marked STALE_RESULT.",
            },
          ],
        };
        await this.store().save(stale);
        return { ok: true, analysis: stale };
      }

      if (result.lifecycle === "ANALYSIS_VALID") {
        this.latestSuccessFingerprint = result.inputFingerprint;
        this.latestSuccessAtMs = Date.now();
      }
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

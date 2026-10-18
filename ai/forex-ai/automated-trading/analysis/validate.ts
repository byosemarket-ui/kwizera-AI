/**
 * Phase 53 — Parse and validate OpenAI structured TA output against input snapshot.
 */
import { collectSnapshotPrices, type AtRawCandle } from "./evidence.js";
import {
  AT_CONFIDENCE_LABEL,
  AT_OPENAI_ANALYSIS_PHASE,
  AT_OPENAI_ANALYSIS_SCHEMA,
  type AtDirectionalBias,
  type AtDataQualityState,
  type AtMtfAgreement,
  type AtOpenAiAnalysisResult,
  type AtPriceLevel,
  type AtScenario,
  type AtTrendState,
  type AtAnalysisLifecycle,
} from "./types.js";
import type { AutomatedTradingEnvironment } from "../types.js";

const BIAS = new Set(["BULLISH", "BEARISH", "NEUTRAL", "UNKNOWN"]);
const TREND = new Set(["UPTREND", "DOWNTREND", "RANGE", "TRANSITION", "UNKNOWN"]);
const MTF = new Set(["AGREE_BULLISH", "AGREE_BEARISH", "CONFLICT", "INSUFFICIENT", "UNKNOWN"]);
const DQ = new Set(["SUFFICIENT", "PARTIAL", "HISTORICAL_ONLY", "INSUFFICIENT", "STALE_QUOTE"]);
const STRENGTH = new Set(["STRONG", "MODERATE", "WEAK", "UNKNOWN"]);

function asStringArray(raw: unknown, max = 12): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function enumOr<T extends string>(raw: unknown, allowed: Set<string>, fallback: T): T {
  const v = String(raw ?? "").trim().toUpperCase();
  return (allowed.has(v) ? v : fallback) as T;
}

function tolForPrices(prices: number[]): number {
  if (!prices.length) return 1e-4;
  const max = Math.max(...prices.map((p) => Math.abs(p)));
  if (max >= 100) return 0.05;
  if (max >= 10) return 0.01;
  return Math.max(1e-5, max * 1e-4);
}

export function validatePriceLevel(
  raw: unknown,
  snapshotPrices: number[],
  tol: number,
): AtPriceLevel {
  if (!raw || typeof raw !== "object") {
    return {
      price: null,
      timeframe: null,
      sourceCandleTime: null,
      provenance: null,
      verifiedAgainstSnapshot: false,
      unavailableReason: "Level missing.",
    };
  }
  const o = raw as Record<string, unknown>;
  const price = typeof o.price === "number" ? o.price : Number(o.price);
  if (!Number.isFinite(price)) {
    return {
      price: null,
      timeframe: typeof o.timeframe === "string" ? o.timeframe : null,
      sourceCandleTime: typeof o.sourceCandleTime === "string" ? o.sourceCandleTime : null,
      provenance: typeof o.provenance === "string" ? o.provenance : null,
      verifiedAgainstSnapshot: false,
      unavailableReason: "Price is non-finite.",
    };
  }
  const near = snapshotPrices.some((p) => Math.abs(p - price) <= tol);
  if (!near) {
    return {
      price: null,
      timeframe: typeof o.timeframe === "string" ? o.timeframe : null,
      sourceCandleTime: typeof o.sourceCandleTime === "string" ? o.sourceCandleTime : null,
      provenance: typeof o.provenance === "string" ? o.provenance : null,
      verifiedAgainstSnapshot: false,
      unavailableReason: "Price not consistent with supplied snapshot OHLC/quote.",
    };
  }
  return {
    price,
    timeframe: typeof o.timeframe === "string" ? o.timeframe : null,
    sourceCandleTime: typeof o.sourceCandleTime === "string" ? o.sourceCandleTime : null,
    provenance: typeof o.provenance === "string" ? o.provenance.slice(0, 240) : null,
    verifiedAgainstSnapshot: true,
    unavailableReason: null,
  };
}

function parseScenario(
  id: "bullish" | "bearish",
  raw: unknown,
  snapshotPrices: number[],
  tol: number,
): AtScenario {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    id,
    summary: String(o.summary ?? "").trim().slice(0, 400) || `${id} scenario not provided.`,
    supportingEvidence: asStringArray(o.supportingEvidence),
    contradictingEvidence: asStringArray(o.contradictingEvidence),
    confirmationConditions: asStringArray(o.confirmationConditions),
    invalidationConditions: asStringArray(o.invalidationConditions),
    potentialEntryZone: o.potentialEntryZone
      ? validatePriceLevel(o.potentialEntryZone, snapshotPrices, tol)
      : null,
  };
}

export function normalizeAtOpenAiAnalysis(input: {
  analysisId: string;
  raw: Record<string, unknown>;
  environment: AutomatedTradingEnvironment;
  environmentEpoch: number;
  instrument: string;
  timeframes: string[];
  primaryTimeframe?: string | null;
  inputFingerprint: string;
  modelRequested: string;
  modelUsed: string | null;
  modelVisionEligible?: boolean;
  trigger?: "scheduled" | "manual" | "legacy";
  monitorConfigEpoch?: number | null;
  chartImage?: AtOpenAiAnalysisResult["chartImage"];
  candlesByTf: Record<string, AtRawCandle[]>;
  historicalOnly: boolean;
  createdAtUtc: string;
  latencyMs: number;
}): { result: AtOpenAiAnalysisResult; lifecycle: AtAnalysisLifecycle } {
  const raw = input.raw;
  const snapshotPrices = collectSnapshotPrices(input.candlesByTf);
  if (typeof raw.bid === "number" && Number.isFinite(raw.bid)) snapshotPrices.push(raw.bid);
  // bid/ask are not on raw model output typically — prices from candles only.
  const tol = tolForPrices(snapshotPrices);

  const directionalBias = enumOr<AtDirectionalBias>(raw.directionalBias, BIAS, "UNKNOWN");
  const trendState = enumOr<AtTrendState>(raw.trendState, TREND, "UNKNOWN");
  const trendStrength = enumOr<"STRONG" | "MODERATE" | "WEAK" | "UNKNOWN">(
    raw.trendStrength,
    STRENGTH,
    "UNKNOWN",
  );
  const mtfAgreement = enumOr<AtMtfAgreement>(raw.mtfAgreement, MTF, "UNKNOWN");
  let dataQuality = enumOr<AtDataQualityState>(raw.dataQuality, DQ, "PARTIAL");
  if (input.historicalOnly && dataQuality === "SUFFICIENT") dataQuality = "HISTORICAL_ONLY";

  const supportLevels = (Array.isArray(raw.supportLevels) ? raw.supportLevels : [])
    .slice(0, 6)
    .map((x) => validatePriceLevel(x, snapshotPrices, tol));
  const resistanceLevels = (Array.isArray(raw.resistanceLevels) ? raw.resistanceLevels : [])
    .slice(0, 6)
    .map((x) => validatePriceLevel(x, snapshotPrices, tol));

  const patterns = (Array.isArray(raw.patterns) ? raw.patterns : []).slice(0, 8).map((p) => {
    const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    return {
      name: String(o.name ?? "").trim().slice(0, 80) || "unnamed",
      timeframe: typeof o.timeframe === "string" ? o.timeframe : null,
      candleTimes: asStringArray(o.candleTimes, 6),
      provenance: typeof o.provenance === "string" ? o.provenance.slice(0, 240) : null,
    };
  });

  const scenarios: AtScenario[] = [
    parseScenario("bullish", (raw.scenarios as Record<string, unknown> | undefined)?.bullish ?? raw.bullishScenario, snapshotPrices, tol),
    parseScenario("bearish", (raw.scenarios as Record<string, unknown> | undefined)?.bearish ?? raw.bearishScenario, snapshotPrices, tol),
  ];

  const blockers: Array<{ code: string; message: string }> = [
    { code: "EXECUTION_NOT_IMPLEMENTED", message: "Analysis does not authorize broker orders." },
    {       code: "RISK_NOT_IMPLEMENTED", message: "Risk / position sizing not applied in Phase 53.1." },
  ];
  if (input.historicalOnly) {
    blockers.push({
      code: "HISTORICAL_ONLY",
      message: "Input is historical OHLC without a verified fresh Bid/Ask.",
    });
  }
  const rejectedLevels =
    [...supportLevels, ...resistanceLevels].filter((l) => !l.verifiedAgainstSnapshot).length;
  if (rejectedLevels > 0) {
    blockers.push({
      code: "LEVELS_UNVERIFIED",
      message: `${rejectedLevels} reported price level(s) rejected against snapshot.`,
    });
  }

  // Force UNKNOWN trend when model claims structure without naming evidence.
  let trendOut = trendState;
  const structureNotes = asStringArray(raw.structureNotes ?? raw.marketStructure, 8);
  if (
    (trendOut === "UPTREND" || trendOut === "DOWNTREND")
    && structureNotes.length === 0
    && asStringArray(raw.keyEvidence).length === 0
  ) {
    trendOut = "UNKNOWN";
    blockers.push({
      code: "STRUCTURE_EVIDENCE_INSUFFICIENT",
      message: "Trend claimed without swing/structure evidence — marked UNKNOWN.",
    });
  }

  let lifecycle: AtAnalysisLifecycle = "ANALYSIS_VALID";
  if (dataQuality === "INSUFFICIENT") lifecycle = "DATA_INSUFFICIENT";
  if (directionalBias === "UNKNOWN" && trendOut === "UNKNOWN" && asStringArray(raw.keyEvidence).length === 0) {
    lifecycle = "DATA_INSUFFICIENT";
  }

  // Reject fabricated win-probability language if present.
  const explanation = String(raw.explanation ?? raw.rationale ?? "").trim().slice(0, 2000);
  if (/win\s*rate|win\s*probabilit|guaranteed/i.test(explanation)) {
    blockers.push({
      code: "CALIBRATION_CLAIM_REJECTED",
      message: "Model claimed calibrated win probability — stripped; label remains NOT CALIBRATED.",
    });
  }

  const result: AtOpenAiAnalysisResult = {
    schemaVersion: AT_OPENAI_ANALYSIS_SCHEMA,
    phase: AT_OPENAI_ANALYSIS_PHASE,
    analysisId: input.analysisId,
    lifecycle,
    environment: input.environment,
    environmentEpoch: input.environmentEpoch,
    instrument: input.instrument,
    timeframes: input.timeframes,
    primaryTimeframe: input.primaryTimeframe ?? input.timeframes[0] ?? null,
    inputFingerprint: input.inputFingerprint,
    provider: "OPENAI",
    modelRequested: input.modelRequested,
    modelUsed: input.modelUsed,
    modelVisionEligible: Boolean(input.modelVisionEligible),
    trigger: input.trigger ?? "legacy",
    monitorConfigEpoch: input.monitorConfigEpoch ?? null,
    chartImage: input.chartImage ?? null,
    directionalBias,
    trendState: trendOut,
    trendStrength,
    mtfAgreement,
    keyEvidence: asStringArray(raw.keyEvidence ?? raw.supportingEvidence),
    counterEvidence: asStringArray(raw.counterEvidence ?? raw.contradictingEvidence),
    supportLevels,
    resistanceLevels,
    patterns,
    structureNotes,
    scenarios,
    explanation: explanation || "No explanation provided by model.",
    dataQuality,
    limitations: asStringArray(raw.limitations ?? raw.missingEvidence, 10),
    blockers,
    confidenceLabel: AT_CONFIDENCE_LABEL,
    evidenceScoreIsWinProbability: false,
    createdAtUtc: input.createdAtUtc,
    latencyMs: input.latencyMs,
    liveLabeled: false,
    placesOrders: false,
    historicalOnly: input.historicalOnly,
  };

  return { result, lifecycle };
}

export function markStaleIfFingerprintMismatch(
  result: AtOpenAiAnalysisResult,
  currentFingerprint: string | null,
): AtOpenAiAnalysisResult {
  if (!currentFingerprint || currentFingerprint === result.inputFingerprint) return result;
  return {
    ...result,
    lifecycle: "STALE_RESULT",
    blockers: [
      ...result.blockers,
      {
        code: "STALE_RESULT",
        message: "Analysis input fingerprint no longer matches the selected instrument/snapshot.",
      },
    ],
  };
}

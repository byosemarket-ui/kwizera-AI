/**
 * Phase 06 — assessMifCandlestickPatterns.
 * Reuses ai/forex-patterns geometry rules. CLOSED tip required for CONFIRMED.
 */
import { createHash } from "node:crypto";
import {
  detectCandlestickPatterns,
  type PatternCandle,
} from "../../../../../forex-patterns/index.js";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import { stableSerialize } from "../../quality/stable-identity.js";
import type { MifStep1DataIntegrityAssessment } from "../../quality/types.js";
import {
  evaluateMifAnalyticalQualityGate,
  type MifQualityGateSource,
} from "../quality/assessment-quality-gate.js";
import {
  MIF_CANDLESTICK_PATTERNS_CONTRACT_ID,
  MIF_CANDLESTICK_PATTERNS_CONTRACT_VERSION,
  MIF_CANDLESTICK_PATTERNS_ENGINE_ID,
  MIF_CANDLESTICK_PATTERNS_ENGINE_VERSION,
} from "./contracts.js";

export type MifCandlestickPatternsStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA";

export interface MifCandlestickPatternRef {
  patternId: string;
  patternName: string;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  status: "CANDIDATE" | "CONFIRMED" | "INVALID";
  candleTimes: number[];
  evidence: string[];
}

export interface MifCandlestickPatternsAssessment {
  contractId: typeof MIF_CANDLESTICK_PATTERNS_CONTRACT_ID;
  contractVersion: typeof MIF_CANDLESTICK_PATTERNS_CONTRACT_VERSION;
  scope: "phase06-candlestick-patterns";
  assessmentId: string;
  inputIdentity: string;
  providerId: typeof MIF_PROVIDER_ID;
  providerSymbol: string;
  timeframe: string;
  instrument: MifCanonicalInstrument | null;
  engineId: string;
  engineVersion: string;
  assessmentTimestamp: string;
  status: MifCandlestickPatternsStatus;
  detections: MifCandlestickPatternRef[];
  patternIds: string[];
  qualityRef: {
    sourceKind: string | null;
    status: string;
    inputIdentity: string | null;
    assessmentId: string | null;
  };
  limitations: string[];
  diagnosticsSummary: string;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  analyticalPatternInformationOnly: true;
  doesNotApproveAiReasoning: true;
}

export interface AssessMifCandlestickPatternsInput {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  instrument?: MifCanonicalInstrument | null;
  quality:
    | { kind: "step1-data-integrity"; assessment: MifStep1DataIntegrityAssessment }
    | null;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

function idHash(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(parts)).digest("hex");
}

function toPatternCandles(candles: readonly MifCanonicalCandle[]): PatternCandle[] {
  return candles
    .slice()
    .sort((a, b) => a.openTimeSec - b.openTimeSec)
    .map((c) => ({
      time: c.openTimeSec,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      isClosed: c.candleState === "CLOSED",
      closed: c.candleState === "CLOSED",
    }));
}

/**
 * Thin HFM wrapper — reuses forex-patterns; remaps provider to HFM_MT5.
 */
export function assessMifCandlestickPatterns(
  input: AssessMifCandlestickPatternsInput,
): MifCandlestickPatternsAssessment {
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim().toUpperCase();
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const instrument = input.instrument ?? null;

  const gate = evaluateMifAnalyticalQualityGate({
    quality: input.quality as MifQualityGateSource | null,
    allowedStatusesForConfirmedAnchors: ["VALID", "WARNING"],
  });
  const qualityRef = {
    sourceKind: gate.sourceKind,
    status: gate.qualityStatus,
    inputIdentity: gate.qualityInputIdentity,
    assessmentId: gate.qualityAssessmentId,
  };

  const limitations = [
    "Rule-based candlestick geometry reused from ai/forex-patterns",
    "Detected pattern is not a confirmed trading signal",
    "HFM MT5 path — forex-patterns internal provider enum remapped in envelope to HFM_MT5",
  ];

  const empty = (
    status: MifCandlestickPatternsStatus,
    reason: string,
  ): MifCandlestickPatternsAssessment => {
    const id = idHash({ providerSymbol, timeframe, status, reason });
    return {
      contractId: MIF_CANDLESTICK_PATTERNS_CONTRACT_ID,
      contractVersion: MIF_CANDLESTICK_PATTERNS_CONTRACT_VERSION,
      scope: "phase06-candlestick-patterns",
      assessmentId: input.assessmentId ?? `csp:${id.slice(0, 16)}`,
      inputIdentity: id,
      providerId: MIF_PROVIDER_ID,
      providerSymbol,
      timeframe,
      instrument,
      engineId: MIF_CANDLESTICK_PATTERNS_ENGINE_ID,
      engineVersion: MIF_CANDLESTICK_PATTERNS_ENGINE_VERSION,
      assessmentTimestamp,
      status,
      detections: [],
      patternIds: [],
      qualityRef,
      limitations,
      diagnosticsSummary: reason,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      analyticalPatternInformationOnly: true,
      doesNotApproveAiReasoning: true,
    };
  };

  if (!providerSymbol || !timeframe) {
    return empty("BLOCKED", "identity required");
  }
  if (!gate.present || gate.qualityStatus === "BLOCKED" || gate.qualityStatus === "MISSING") {
    return empty("BLOCKED", `quality ${gate.qualityStatus}`);
  }

  const closed = input.candles.filter((c) => c.candleState === "CLOSED");
  if (closed.length < 1) {
    return empty("INSUFFICIENT_DATA", "need_closed_candles");
  }

  // forex-patterns PatternProviderId is legacy-typed; detector is provider-agnostic geometry.
  const raw = detectCandlestickPatterns({
    provider: "FXCM",
    symbol: providerSymbol,
    timeframe,
    candles: toPatternCandles(input.candles),
    includeForming: false,
  });

  const detections: MifCandlestickPatternRef[] = (raw.detections ?? []).map((d) => ({
    patternId: d.patternId,
    patternName: d.patternName,
    direction: d.direction,
    status: d.status,
    candleTimes: d.candleTimes ?? [],
    evidence: d.evidence ?? [],
  }));

  const id = idHash({
    contractId: MIF_CANDLESTICK_PATTERNS_CONTRACT_ID,
    providerSymbol,
    timeframe,
    patternIds: detections.map((d) => d.patternId),
    tip: closed[closed.length - 1]?.openTimeSec ?? null,
  });

  return {
    contractId: MIF_CANDLESTICK_PATTERNS_CONTRACT_ID,
    contractVersion: MIF_CANDLESTICK_PATTERNS_CONTRACT_VERSION,
    scope: "phase06-candlestick-patterns",
    assessmentId: input.assessmentId ?? `csp:${id.slice(0, 16)}`,
    inputIdentity: id,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    timeframe,
    instrument,
    engineId: MIF_CANDLESTICK_PATTERNS_ENGINE_ID,
    engineVersion: MIF_CANDLESTICK_PATTERNS_ENGINE_VERSION,
    assessmentTimestamp,
    status: detections.length ? "VALID" : "WARNING",
    detections,
    patternIds: detections.map((d) => d.patternId),
    qualityRef,
    limitations,
    diagnosticsSummary:
      `detections=${detections.length}; tipClosed=true; providerEnvelope=HFM_MT5`,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    analyticalPatternInformationOnly: true,
    doesNotApproveAiReasoning: true,
  };
}

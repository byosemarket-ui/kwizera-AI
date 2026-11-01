/**
 * Phase 4.18C — Unified analysis reconciler (pure, no broker side effects).
 * Single authority for CanonicalAnalysisResult finalOutcome + direction.
 *
 * Rule priority:
 *  1 STALE_DATA
 *  2 INSUFFICIENT_DATA
 *  3 instrument / timeframe isolation mismatches
 *  4 HTF CONFLICT → NO_TRADE (missing HTF ≠ conflict)
 *  5 Deterministic NO_TRADE / NO_CROSSOVER → AI ignored
 *  6 Deterministic vs AI opposite → CONFLICT
 *  7 Deterministic BUY/SELL (+ optional AI agree / AI absent)
 */
import { createHash, randomUUID } from "node:crypto";
import type { AutomatedTradingEnvironment } from "../types.js";
import { calculateAnalysisConfidence } from "./confidence.js";
import {
  ANALYSIS_CONFIDENCE_MODEL_VERSION,
  ANALYSIS_CONFIDENCE_TYPE,
  CANONICAL_ANALYSIS_SCHEMA,
  CANONICAL_ANALYSIS_VERSION,
  type CanonicalAiInterpretationSlice,
  type CanonicalAnalysisResult,
  type CanonicalDeterministicStrategySlice,
  type CanonicalHtfContext,
  type CanonicalIndicatorSet,
  type CanonicalMarketDirection,
  type CanonicalMarketInterpretation,
  type CanonicalQuoteSnapshot,
  type CanonicalTimeframeId,
  type ProvenancedValue,
  type ReconciliationCode,
} from "./canonical-analysis.types.js";

const STALE_REASON_CODES = new Set([
  "MARKET_INACTIVE",
  "MARKET_CLOSED",
  "HEARTBEAT_ONLY_NO_PRICE_CHANGE",
  "QUOTE_AGE_EXCEEDED",
  "NO_QUOTE_UPDATES",
  "FEED_NOT_LIVE",
  "BID_ASK_MISSING",
  "BID_ASK_INVALID",
  "VERIFICATION_MISSING",
  "INSTRUMENT_MISMATCH",
  "PRICE_CHANGE_AGE_UNKNOWN",
  "SOURCE_TIMESTAMP_TOO_OLD",
]);

export interface ReconcileAnalysisInput {
  environment: AutomatedTradingEnvironment;
  instrument: string;
  primaryTimeframe: CanonicalTimeframeId;
  analyzedAtUtc?: string;
  trigger?: CanonicalAnalysisResult["trigger"];
  evidenceFingerprint?: string;
  quote: CanonicalQuoteSnapshot;
  /** When false/null and strategyReady false → insufficient. */
  candleStrategyReady?: boolean | null;
  candleQuality?: CanonicalAnalysisResult["candleQuality"];
  indicators: CanonicalIndicatorSet;
  deterministic: CanonicalDeterministicStrategySlice | null;
  ai?: CanonicalAiInterpretationSlice | null;
  htf?: CanonicalHtfContext | null;
  /** Expected instrument for isolation — defaults to input.instrument. */
  expectedInstrument?: string;
  /** Optional: AI/strategy instrument must match if provided. */
  aiInstrument?: string | null;
  strategyInstrument?: string | null;
  analysisId?: string;
}

function normalizeInstr(s: string | null | undefined): string {
  return String(s ?? "").replace(/\s+/g, "").toUpperCase();
}

function pv<T>(
  value: T,
  provenance: ProvenancedValue<T>["provenance"],
  sourceComponent: string,
  asOfUtc: string | null,
): ProvenancedValue<T> {
  return { value, provenance, sourceComponent, asOfUtc };
}

function defaultFingerprint(input: ReconcileAnalysisInput): string {
  const h = createHash("sha256");
  h.update(input.instrument);
  h.update("|");
  h.update(input.primaryTimeframe);
  h.update("|");
  h.update(input.quote.snapshotFingerprint ?? "");
  h.update("|");
  h.update(String(input.deterministic?.closedCandle?.openTimeSec ?? ""));
  h.update("|");
  h.update(String(input.indicators.fastSma.value));
  h.update("|");
  h.update(String(input.indicators.slowSma.value));
  h.update("|");
  h.update(String(input.indicators.atr.value));
  return h.digest("hex").slice(0, 24);
}

function isStaleQuote(quote: CanonicalQuoteSnapshot): boolean {
  if (!quote.quoteFresh) return true;
  const code = String(quote.freshnessReasonCode ?? "");
  if (STALE_REASON_CODES.has(code)) return true;
  return false;
}

function isInsufficient(input: ReconcileAnalysisInput): { yes: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const det = input.deterministic;
  if (!det) {
    reasons.push("Deterministic strategy slice missing.");
  } else {
    if (
      det.code === "INSUFFICIENT_CLOSED_CANDLES"
      || det.code === "CANDLES_MISSING"
      || det.code === "CANDLES_INVALID"
      || det.code === "SMA_UNAVAILABLE"
      || det.code === "ATR_UNAVAILABLE"
      || det.code === "POINT_SIZE_UNVERIFIED"
      || det.code === "LEVELS_INVALID"
    ) {
      reasons.push(`Strategy code ${det.code}.`);
    }
  }
  if (input.candleStrategyReady === false) {
    reasons.push("Candle quality strategyReady=false.");
  }
  if (input.candleQuality && input.candleQuality.strategyReady === false) {
    reasons.push(...(input.candleQuality.blockers ?? []).slice(0, 3));
  }
  const atr = input.indicators.atr.value;
  if (atr == null || !Number.isFinite(atr) || atr <= 0) {
    // Only flag ATR when we expected a directional eval (det present and not already NO_TRADE insufficient)
    if (det && det.direction !== "NO_TRADE" && det.code !== "NO_CROSSOVER") {
      reasons.push("ATR missing or non-positive.");
    }
    if (det?.code === "ATR_UNAVAILABLE") {
      // already added
    } else if (!det || det.code === "ATR_UNAVAILABLE") {
      if (!reasons.some((r) => r.includes("ATR"))) reasons.push("ATR unavailable.");
    }
  }
  // Explicit: forming candles never counted — enforced upstream; if closedCandle null with BUY/SELL → insufficient
  if (det && (det.direction === "BUY" || det.direction === "SELL") && !det.closedCandle) {
    reasons.push("Directional strategy missing closed candle reference.");
  }
  return { yes: reasons.length > 0, reasons };
}

function buildBase(
  input: ReconcileAnalysisInput,
  partial: {
    finalOutcome: CanonicalAnalysisResult["finalOutcome"];
    direction: CanonicalMarketDirection | null;
    reconciliationCode: ReconciliationCode | string;
    explanation: string[];
    validationErrors: Array<{ code: string; message: string }>;
    dataQuality: CanonicalAnalysisResult["dataQuality"];
  },
): CanonicalAnalysisResult {
  const analyzedAtUtc = input.analyzedAtUtc ?? new Date().toISOString();
  const instrument = normalizeInstr(input.instrument);

  let marketInterpretation: CanonicalMarketInterpretation | null = null;
  if (partial.direction === "BUY") marketInterpretation = "BULLISH";
  if (partial.direction === "SELL") marketInterpretation = "BEARISH";

  const conf = calculateAnalysisConfidence({
    finalOutcome: partial.finalOutcome,
    direction: partial.direction,
    indicators: input.indicators,
    deterministic: input.deterministic,
    ai: input.ai ?? null,
    htf: input.htf ?? null,
    quote: input.quote,
    candleStrategyReady: input.candleStrategyReady ?? input.candleQuality?.strategyReady ?? null,
  });

  const detDir = input.deterministic?.direction;
  const trendFromDet =
    detDir === "BUY"
      ? "BULLISH"
      : detDir === "SELL"
        ? "BEARISH"
        : "UNKNOWN";

  return {
    schemaVersion: CANONICAL_ANALYSIS_SCHEMA,
    analysisVersion: CANONICAL_ANALYSIS_VERSION,
    analysisId: input.analysisId ?? randomUUID(),
    environment: input.environment,
    instrument,
    provider: "FOREXCONNECT",
    primaryTimeframe: input.primaryTimeframe,
    analyzedAtUtc,
    trigger: input.trigger ?? "unit_test",
    evidenceFingerprint: input.evidenceFingerprint ?? defaultFingerprint(input),
    quote: { ...input.quote, instrument: normalizeInstr(input.quote.instrument) || instrument },
    dataQuality: partial.dataQuality,
    candleQuality: input.candleQuality ?? null,
    indicators: input.indicators,
    marketStructure: {
      trendDirection: pv(
        trendFromDet,
        "DETERMINISTIC_COMPUTED",
        "reconciler",
        analyzedAtUtc,
      ),
      trendStrength: pv("UNKNOWN", "DETERMINISTIC_COMPUTED", "reconciler", analyzedAtUtc),
      momentum: pv(
        partial.direction === "BUY" ? "UP" : partial.direction === "SELL" ? "DOWN" : "UNKNOWN",
        "DETERMINISTIC_COMPUTED",
        "reconciler",
        analyzedAtUtc,
      ),
      volatilityRegime: pv("UNKNOWN", "DETERMINISTIC_COMPUTED", "reconciler", analyzedAtUtc),
    },
    supportResistance: {
      support: (input.ai?.supportLevels ?? [])
        .filter((l) => l.price != null)
        .map((l) =>
          pv(l.price, "AI_INTERPRETED", "openai.supportLevels", analyzedAtUtc),
        ),
      resistance: (input.ai?.resistanceLevels ?? [])
        .filter((l) => l.price != null)
        .map((l) =>
          pv(l.price, "AI_INTERPRETED", "openai.resistanceLevels", analyzedAtUtc),
        ),
    },
    htf: input.htf ?? null,
    deterministic: input.deterministic,
    ai: input.ai ?? null,
    finalOutcome: partial.finalOutcome,
    direction: partial.direction,
    marketInterpretation,
    confidencePct: conf.confidencePct,
    confidenceType: ANALYSIS_CONFIDENCE_TYPE,
    confidenceModelVersion: ANALYSIS_CONFIDENCE_MODEL_VERSION,
    confidenceBreakdown: conf.breakdown,
    confidenceLimitations: conf.limitations,
    reconciliationCode: partial.reconciliationCode,
    explanation: partial.explanation,
    validationErrors: partial.validationErrors,
    placesOrders: false,
    acceptsForExecution: false,
  };
}

/**
 * Reconcile deterministic strategy (+ optional AI + HTF) into one canonical result.
 */
export function reconcileAnalysis(input: ReconcileAnalysisInput): CanonicalAnalysisResult {
  const instrument = normalizeInstr(input.instrument);
  const expected = normalizeInstr(input.expectedInstrument ?? input.instrument);

  // Isolation: instrument mismatch
  if (!instrument || (expected && instrument !== expected)) {
    return buildBase(input, {
      finalOutcome: "INSUFFICIENT_DATA",
      direction: null,
      reconciliationCode: "RECON_INSTRUMENT_MISMATCH",
      explanation: [
        `Instrument isolation failed: got "${instrument}" expected "${expected}".`,
        "No silent fallback to another instrument.",
      ],
      validationErrors: [{ code: "RECON_INSTRUMENT_MISMATCH", message: "Instrument mismatch." }],
      dataQuality: "INSUFFICIENT",
    });
  }

  const stratInstr = normalizeInstr(input.strategyInstrument ?? "");
  if (stratInstr && stratInstr !== instrument) {
    return buildBase(input, {
      finalOutcome: "INSUFFICIENT_DATA",
      direction: null,
      reconciliationCode: "RECON_INSTRUMENT_MISMATCH",
      explanation: [
        `Strategy instrument ${stratInstr} ≠ analysis instrument ${instrument}.`,
      ],
      validationErrors: [{ code: "RECON_INSTRUMENT_MISMATCH", message: "Strategy instrument mismatch." }],
      dataQuality: "INSUFFICIENT",
    });
  }

  const aiInstr = normalizeInstr(input.aiInstrument ?? "");
  if (input.ai && aiInstr && aiInstr !== instrument) {
    return buildBase(input, {
      finalOutcome: "INSUFFICIENT_DATA",
      direction: null,
      reconciliationCode: "RECON_INSTRUMENT_MISMATCH",
      explanation: [
        `AI instrument ${aiInstr} ≠ analysis instrument ${instrument}.`,
        "AI evidence discarded for isolation.",
      ],
      validationErrors: [{ code: "RECON_INSTRUMENT_MISMATCH", message: "AI instrument mismatch." }],
      dataQuality: "INSUFFICIENT",
    });
  }

  // Isolation on closed candle ref (instrument + timeframe)
  const closedRef = input.deterministic?.closedCandle;
  if (closedRef) {
    const closedInstr = normalizeInstr(closedRef.instrument);
    if (closedInstr && closedInstr !== instrument) {
      return buildBase(input, {
        finalOutcome: "INSUFFICIENT_DATA",
        direction: null,
        reconciliationCode: "RECON_INSTRUMENT_MISMATCH",
        explanation: [
          `Closed candle instrument ${closedInstr} ≠ analysis instrument ${instrument}.`,
          "EUR/USD candles cannot enter an XAU/USD result.",
        ],
        validationErrors: [{ code: "RECON_INSTRUMENT_MISMATCH", message: "Candle instrument mismatch." }],
        dataQuality: "INSUFFICIENT",
      });
    }
    if (closedRef.timeframe !== input.primaryTimeframe) {
      return buildBase(input, {
        finalOutcome: "INSUFFICIENT_DATA",
        direction: null,
        reconciliationCode: "RECON_TIMEFRAME_MISMATCH",
        explanation: [
          `Closed candle timeframe ${closedRef.timeframe} ≠ primary ${input.primaryTimeframe}.`,
          "Timeframes must not be mixed in one analysis.",
        ],
        validationErrors: [{ code: "RECON_TIMEFRAME_MISMATCH", message: "Timeframe mismatch." }],
        dataQuality: "INSUFFICIENT",
      });
    }
  }

  // Rule 1 — stale
  if (isStaleQuote(input.quote)) {
    return buildBase(input, {
      finalOutcome: "STALE_DATA",
      direction: null,
      reconciliationCode: "RECON_STALE_QUOTE",
      explanation: [
        `Quote not fresh (reason=${input.quote.freshnessReasonCode ?? "quoteFresh=false"}).`,
        "Heartbeat alone is never a genuine price update.",
        "No BUY/SELL manufactured.",
      ],
      validationErrors: [{ code: "RECON_STALE_QUOTE", message: "Stale or inactive market data." }],
      dataQuality: "STALE_QUOTE",
    });
  }

  // Rule 2 — insufficient
  const insuff = isInsufficient(input);
  if (insuff.yes) {
    return buildBase(input, {
      finalOutcome: "INSUFFICIENT_DATA",
      direction: null,
      reconciliationCode: "RECON_INSUFFICIENT",
      explanation: [
        "Insufficient market evidence for directional analysis.",
        ...insuff.reasons,
      ],
      validationErrors: insuff.reasons.map((message) => ({
        code: "RECON_INSUFFICIENT",
        message,
      })),
      dataQuality: "INSUFFICIENT",
    });
  }

  const det = input.deterministic!;
  const ai = input.ai ?? null;
  const htf = input.htf ?? null;

  // Rule 8 — HTF conflict (genuine only; missing ≠ conflict)
  if (htf && htf.agreement === "CONFLICT") {
    return buildBase(input, {
      finalOutcome: "NO_TRADE",
      direction: null,
      reconciliationCode: "RECON_HTF_CONFLICT",
      explanation: [
        "Higher-timeframe deterministic agreement is CONFLICT.",
        "Safer policy: block directional candidate (NO_TRADE validity).",
      ],
      validationErrors: [{ code: "RECON_HTF_CONFLICT", message: "HTF directional conflict." }],
      dataQuality: "SUFFICIENT",
    });
  }

  // Rule 3 — deterministic NO_TRADE / NO_CROSSOVER
  if (det.direction === "NO_TRADE" || det.code === "NO_CROSSOVER") {
    return buildBase(input, {
      finalOutcome: "NO_TRADE",
      direction: null,
      reconciliationCode: "RECON_NO_CROSS_AI_IGNORED",
      explanation: [
        `Deterministic strategy ${det.code} / NO_TRADE.`,
        ai?.direction
          ? `AI ${ai.direction} ignored — cannot create direction without deterministic cross.`
          : "AI unavailable or non-directional.",
      ],
      validationErrors: [],
      dataQuality: "SUFFICIENT",
    });
  }

  // Rule 4 — opposite directions
  if (
    ai
    && ai.direction
    && (det.direction === "BUY" || det.direction === "SELL")
    && ai.direction !== det.direction
  ) {
    return buildBase(input, {
      finalOutcome: "CONFLICT",
      direction: null,
      reconciliationCode: "RECON_DIR_CONFLICT",
      explanation: [
        `Deterministic ${det.direction} conflicts with AI ${ai.direction}.`,
        "No averaging; AI cannot override deterministic evidence.",
      ],
      validationErrors: [{ code: "RECON_DIR_CONFLICT", message: "Opposite BUY/SELL conclusions." }],
      dataQuality: "SUFFICIENT",
    });
  }

  // Rules 5–7 — deterministic BUY/SELL
  if (det.direction === "BUY" || det.direction === "SELL") {
    const aiAbsent = !ai || !ai.direction;
    const code: ReconciliationCode = aiAbsent
      ? "RECON_DET_ONLY"
      : det.direction === "BUY"
        ? "RECON_DET_BUY"
        : "RECON_DET_SELL";
    const outcome = det.direction === "BUY" ? "BUY_CANDIDATE" : "SELL_CANDIDATE";
    const explanation = [
      `Deterministic ${det.direction} (${det.code}) is authoritative.`,
      `ATR method=${input.indicators.atrMethod}; fastSma=${input.indicators.fastSma.value}; slowSma=${input.indicators.slowSma.value}.`,
      aiAbsent
        ? "AI unavailable/skipped — deterministic result retained (RECON_DET_ONLY)."
        : `AI ${ai!.direction} agrees.`,
      htf && (htf.agreement === "AGREE_BULLISH" || htf.agreement === "AGREE_BEARISH")
        ? `HTF ${htf.agreement}.`
        : htf
          ? `HTF ${htf.agreement} (not CONFLICT).`
          : "HTF context not provided — not treated as conflict.",
    ];
    return buildBase(input, {
      finalOutcome: outcome,
      direction: det.direction,
      reconciliationCode: code,
      explanation,
      validationErrors: [],
      dataQuality: "SUFFICIENT",
    });
  }

  // Fallback — should not reach
  return buildBase(input, {
    finalOutcome: "INSUFFICIENT_DATA",
    direction: null,
    reconciliationCode: "RECON_INSUFFICIENT",
    explanation: ["Unrecognized deterministic state."],
    validationErrors: [{ code: "RECON_INSUFFICIENT", message: "Unrecognized state." }],
    dataQuality: "INSUFFICIENT",
  });
}

/** Helper to build deterministic-computed indicator set from strategy numbers. */
export function indicatorsFromStrategyValues(input: {
  fastSma: number | null;
  slowSma: number | null;
  atr: number | null;
  atrLength?: number;
  asOfUtc?: string;
}): CanonicalIndicatorSet {
  const asOf = input.asOfUtc ?? null;
  return {
    fastSma: pv(input.fastSma, "DETERMINISTIC_COMPUTED", "evaluateSmaCrossoverStrategy", asOf),
    slowSma: pv(input.slowSma, "DETERMINISTIC_COMPUTED", "evaluateSmaCrossoverStrategy", asOf),
    atr: pv(input.atr, "DETERMINISTIC_COMPUTED", "atrAt/SMA_OF_TR", asOf),
    atrMethod: "SMA_OF_TR",
    atrLength: input.atrLength ?? 14,
  };
}

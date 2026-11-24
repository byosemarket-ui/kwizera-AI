/**
 * Research reliability score = evidence completeness, NOT win/event probability.
 */
import { MIF_RESEARCH_RELIABILITY_MODEL_VERSION } from "./contracts.js";
import type {
  HfmCandleReliabilityReport,
  HfmEventReliabilityReport,
  HfmLiveHistoricalCompareReport,
  HfmQuoteReliabilityReport,
  HfmRegimeShiftReport,
  HfmResearchInputGateReport,
  HfmResearchReliabilityScore,
  HfmStrategyRobustnessReport,
} from "./types.js";

const WEIGHTS = {
  quote: 0.2,
  candles: 0.25,
  compare: 0.1,
  gate: 0.2,
  robustness: 0.15,
  regime: 0.05,
  events: 0.05,
} as const;

function component(
  id: string,
  present: boolean,
  quality: number | null,
  note: string,
): { id: string; contribution: number | null; missing: boolean; note: string } {
  if (!present || quality == null) {
    return { id, contribution: null, missing: true, note };
  }
  return { id, contribution: quality, missing: false, note };
}

export function computeResearchReliabilityScore(input: {
  quote: HfmQuoteReliabilityReport | null;
  candles: HfmCandleReliabilityReport | null;
  compare: HfmLiveHistoricalCompareReport | null;
  gate: HfmResearchInputGateReport | null;
  robustness: HfmStrategyRobustnessReport | null;
  regime: HfmRegimeShiftReport | null;
  events: HfmEventReliabilityReport | null;
}): HfmResearchReliabilityScore {
  const quoteQ = (() => {
    if (!input.quote) return null;
    if (input.quote.classification === "MISSING" || input.quote.classification === "INVALID") return 0;
    if (input.quote.classification === "LIVE" || input.quote.classification === "FRESH") return 1;
    if (input.quote.classification === "RECOVERING") return 0.7;
    if (input.quote.classification === "STALE") return 0.4;
    return 0.2;
  })();

  const candleQ = (() => {
    if (!input.candles) return null;
    const s = input.candles.dataset.qualityStatus;
    if (s === "VALID") return 1;
    if (s === "VALID_WITH_WARNINGS") return 0.75;
    if (s === "INCOMPLETE" || s === "INSUFFICIENT_HISTORY") return 0.35;
    return 0;
  })();

  const compareQ = (() => {
    if (!input.compare) return null;
    if (input.compare.status === "CONSISTENT") return 1;
    if (input.compare.status === "CONSISTENT_WITH_WARNINGS") return 0.7;
    if (input.compare.status === "INSUFFICIENT_DATA" || input.compare.status === "NOT_COMPARABLE") {
      return null;
    }
    if (input.compare.status === "DIVERGENT") return 0.25;
    return 0;
  })();

  const gateQ = (() => {
    if (!input.gate) return null;
    if (input.gate.gate === "RESEARCH_ALLOWED") return 1;
    if (input.gate.gate === "RESEARCH_ALLOWED_WITH_WARNINGS") return 0.7;
    if (input.gate.gate === "INSUFFICIENT_DATA") return 0.3;
    return 0;
  })();

  const robQ = (() => {
    if (!input.robustness) return null;
    if (input.robustness.status === "STABLE_WITHIN_BASELINE") return 1;
    if (input.robustness.status === "INSUFFICIENT_SAMPLE") return null;
    if (input.robustness.status === "DEGRADATION_SUSPECTED") return 0.45;
    if (input.robustness.status === "REGIME_SHIFT_DETECTED") return 0.4;
    if (input.robustness.status === "DEGRADATION_CONFIRMED" || input.robustness.status === "DATA_QUALITY_BLOCKED") {
      return 0.15;
    }
    return null;
  })();

  const regimeQ = (() => {
    if (!input.regime) return null;
    if (input.regime.status === "NO_SHIFT") return 1;
    if (input.regime.status === "REGIME_SHIFT_DETECTED") return 0.4;
    return null;
  })();

  const eventQ = (() => {
    if (!input.events) return null;
    if (input.events.status === "VALID") return 1;
    if (input.events.status === "FIXTURE_ONLY") return 0.5;
    if (input.events.status === "BLOCKED_CONFIGURATION_REQUIRED" || input.events.status === "UNAVAILABLE") {
      return null;
    }
    return 0.2;
  })();

  const components = [
    component("quote", quoteQ != null, quoteQ, "Live quote evidence quality"),
    component("candles", candleQ != null, candleQ, "Historical candle dataset quality"),
    component("compare", compareQ != null, compareQ, "Live vs historical consistency"),
    component("gate", gateQ != null, gateQ, "Research input reliability gate"),
    component("robustness", robQ != null, robQ, "Strategy robustness vs baseline"),
    component("regime", regimeQ != null, regimeQ, "Regime shift evidence"),
    component("events", eventQ != null, eventQ, "Event data provenance"),
  ];

  const present = components.filter((c) => !c.missing && c.contribution != null);
  if (present.length < 2) {
    return {
      value: null,
      availability: "INSUFFICIENT_INPUTS",
      components,
      definition:
        "Evidence completeness score (0..1). Not win probability, not event probability, not calibration.",
      isWinProbability: false,
      isEventProbability: false,
      isProbabilityCalibration: false,
      modelVersion: MIF_RESEARCH_RELIABILITY_MODEL_VERSION,
    };
  }

  let weightSum = 0;
  let scored = 0;
  for (const c of present) {
    const w = WEIGHTS[c.id as keyof typeof WEIGHTS] ?? 0.1;
    weightSum += w;
    scored += w * (c.contribution as number);
  }
  const value = weightSum > 0 ? scored / weightSum : null;

  return {
    value,
    availability: value == null ? "INSUFFICIENT_INPUTS" : "AVAILABLE",
    components,
    definition:
      "Weighted evidence completeness across quote/candles/compare/gate/robustness/regime/events. Missing components are reported, not treated as zero-risk. Not win probability. DIAGNOSTIC_USES_CONFIDENCE_NOT_EVENT_PROBABILITY.",
    isWinProbability: false,
    isEventProbability: false,
    isProbabilityCalibration: false,
    modelVersion: MIF_RESEARCH_RELIABILITY_MODEL_VERSION,
  };
}

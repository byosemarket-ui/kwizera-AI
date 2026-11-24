import { createHash } from "node:crypto";
import { MIF_RR_MAX_ALERTS } from "./contracts.js";
import type {
  HfmCandleReliabilityReport,
  HfmEventReliabilityReport,
  HfmLiveHistoricalCompareReport,
  HfmQuoteReliabilityReport,
  HfmRegimeShiftReport,
  HfmReliabilityAlert,
  HfmResearchInputGateReport,
  HfmStrategyRobustnessReport,
} from "./types.js";

function alert(partial: Omit<HfmReliabilityAlert, "alertId" | "status" | "isBuySellAlert">): HfmReliabilityAlert {
  const alertId = createHash("sha256")
    .update(JSON.stringify(partial))
    .digest("hex")
    .slice(0, 20);
  return {
    ...partial,
    alertId: `rra_${alertId}`,
    status: "OPEN",
    isBuySellAlert: false,
  };
}

export function buildReliabilityAlerts(input: {
  quote: HfmQuoteReliabilityReport | null;
  candles: HfmCandleReliabilityReport | null;
  compare: HfmLiveHistoricalCompareReport | null;
  gate: HfmResearchInputGateReport | null;
  robustness: HfmStrategyRobustnessReport | null;
  regime: HfmRegimeShiftReport | null;
  events: HfmEventReliabilityReport | null;
  detectionTimestamp: string;
}): HfmReliabilityAlert[] {
  const out: HfmReliabilityAlert[] = [];
  const push = (a: HfmReliabilityAlert) => {
    if (out.length < MIF_RR_MAX_ALERTS) out.push(a);
  };

  if (input.quote?.classification === "MISSING") {
    push(alert({
      category: "QUOTE_MISSING",
      severity: "CRITICAL",
      symbol: input.quote.symbol,
      timeframe: null,
      relatedResearchRunId: null,
      relatedDatasetId: null,
      detectionTimestamp: input.detectionTimestamp,
      explanation: "No quote available for validation",
      recommendedInvestigation: "Check HFM subscription and MT5 agent acquisition",
      evidenceRefs: input.quote.findings,
    }));
  }
  if (input.quote?.classification === "STALE" || input.quote?.classification === "DELAYED") {
    push(alert({
      category: "QUOTE_STALE",
      severity: "WARNING",
      symbol: input.quote.symbol,
      timeframe: null,
      relatedResearchRunId: null,
      relatedDatasetId: null,
      detectionTimestamp: input.detectionTimestamp,
      explanation: `Quote classification=${input.quote.classification} ageSec=${input.quote.ageSec}`,
      recommendedInvestigation: "Verify broker feed and acquisition timestamps",
      evidenceRefs: input.quote.findings,
    }));
  }
  if (input.quote?.spreadAbnormal) {
    push(alert({
      category: "ABNORMAL_SPREAD",
      severity: "WARNING",
      symbol: input.quote.symbol,
      timeframe: null,
      relatedResearchRunId: null,
      relatedDatasetId: null,
      detectionTimestamp: input.detectionTimestamp,
      explanation: `Spread ${input.quote.spread} flagged abnormal vs recent median`,
      recommendedInvestigation: "Review liquidity / session / feed anomaly",
      evidenceRefs: input.quote.findings,
    }));
  }
  if (input.candles && !input.candles.dataset.mayProceed) {
    push(alert({
      category: input.candles.dataset.missingCandleCount > 0
        ? "CANDLE_DATA_GAP"
        : "CANDLE_INTEGRITY_FAILURE",
      severity: "CRITICAL",
      symbol: input.candles.dataset.symbol,
      timeframe: input.candles.dataset.timeframe,
      relatedResearchRunId: null,
      relatedDatasetId: input.candles.dataset.datasetId,
      detectionTimestamp: input.detectionTimestamp,
      explanation: `Dataset quality=${input.candles.dataset.qualityStatus}`,
      recommendedInvestigation: "Inspect OHLC/gaps/duplicates before research",
      evidenceRefs: input.candles.dataset.blockReasons,
    }));
  }
  if (input.compare?.status === "DIVERGENT") {
    push(alert({
      category: "HISTORICAL_LIVE_DIVERGENCE",
      severity: "WARNING",
      symbol: input.compare.symbol,
      timeframe: input.compare.timeframe,
      relatedResearchRunId: null,
      relatedDatasetId: null,
      detectionTimestamp: input.detectionTimestamp,
      explanation: input.compare.note,
      recommendedInvestigation: "Compare quote mid vs closed candle range with provenance",
      evidenceRefs: input.compare.divergences.map((d) => d.explanation),
    }));
  }
  if (input.gate && (input.gate.gate === "RESEARCH_BLOCKED" || input.gate.gate === "SOURCE_UNVERIFIED" || input.gate.gate === "INSUFFICIENT_DATA")) {
    push(alert({
      category: "RESEARCH_INPUT_BLOCKED",
      severity: "CRITICAL",
      symbol: null,
      timeframe: null,
      relatedResearchRunId: input.gate.relatedResearchRunId,
      relatedDatasetId: input.gate.datasetId,
      detectionTimestamp: input.detectionTimestamp,
      explanation: `Research gate=${input.gate.gate}`,
      recommendedInvestigation: input.gate.blockReasons.join("; ") || "See gate block reasons",
      evidenceRefs: input.gate.blockReasons,
    }));
  }
  if (input.robustness?.status === "DEGRADATION_SUSPECTED") {
    push(alert({
      category: "STRATEGY_DEGRADATION_SUSPECTED",
      severity: "WARNING",
      symbol: input.robustness.symbol,
      timeframe: input.robustness.timeframe,
      relatedResearchRunId: null,
      relatedDatasetId: null,
      detectionTimestamp: input.detectionTimestamp,
      explanation: input.robustness.explanation,
      recommendedInvestigation: "Increase sample / review regime / cost assumptions",
      evidenceRefs: [input.robustness.criteriaVersion],
    }));
  }
  if (input.robustness?.status === "DEGRADATION_CONFIRMED") {
    push(alert({
      category: "STRATEGY_DEGRADATION_CONFIRMED",
      severity: "CRITICAL",
      symbol: input.robustness.symbol,
      timeframe: input.robustness.timeframe,
      relatedResearchRunId: null,
      relatedDatasetId: null,
      detectionTimestamp: input.detectionTimestamp,
      explanation: input.robustness.explanation,
      recommendedInvestigation: "Do not auto-disable; investigate research windows",
      evidenceRefs: [input.robustness.criteriaVersion],
    }));
  }
  if (input.robustness?.status === "INSUFFICIENT_SAMPLE") {
    push(alert({
      category: "INSUFFICIENT_SAMPLE",
      severity: "INFO",
      symbol: input.robustness.symbol,
      timeframe: input.robustness.timeframe,
      relatedResearchRunId: null,
      relatedDatasetId: null,
      detectionTimestamp: input.detectionTimestamp,
      explanation: input.robustness.explanation,
      recommendedInvestigation: "Collect more closed-trade outcomes before concluding",
      evidenceRefs: [],
    }));
  }
  if (input.regime?.status === "REGIME_SHIFT_DETECTED") {
    push(alert({
      category: "REGIME_SHIFT_DETECTED",
      severity: "WARNING",
      symbol: null,
      timeframe: input.regime.timeframe,
      relatedResearchRunId: null,
      relatedDatasetId: null,
      detectionTimestamp: input.detectionTimestamp,
      explanation: `${input.regime.historicalRegime} → ${input.regime.currentRegime}`,
      recommendedInvestigation: "Re-evaluate strategy under current regime evidence",
      evidenceRefs: input.regime.evidence,
    }));
  }
  if (input.events?.status === "UNAVAILABLE" || input.events?.status === "BLOCKED_CONFIGURATION_REQUIRED") {
    push(alert({
      category: "EVENT_DATA_UNAVAILABLE",
      severity: "INFO",
      symbol: null,
      timeframe: null,
      relatedResearchRunId: null,
      relatedDatasetId: null,
      detectionTimestamp: input.detectionTimestamp,
      explanation: `Event reliability=${input.events.status}`,
      recommendedInvestigation: "Phase 07 gates / fixture-only — do not invent events",
      evidenceRefs: input.events.notes,
    }));
  }

  return out;
}

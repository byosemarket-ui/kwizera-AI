/**
 * Phase 5B.2 Step 3 — dimension comparisons between Phase 2 and MIF.
 * Does not equate vocabularies directly; classifies interpretation relationships.
 */
import type { HfmAnalysisDataQualityReport, HfmAnalysisSyncReport } from "../../../analysis/types.js";
import type { MifStep1DataIntegrityAssessment } from "../types.js";
import type { MifQuoteQualityAssessment } from "../quote/types.js";
import type { MifMultiTimeframeQualityAssessment } from "../multi-timeframe/types.js";
import type { MifShadowDimensionResult } from "./types.js";

function phase2HasErrorCode(q: HfmAnalysisDataQualityReport, code: string): boolean {
  return q.errors.some((e) => e.code === code) || q.warnings.some((w) => w.code === code);
}

export function compareCandleIntegrity(
  phase2: HfmAnalysisDataQualityReport,
  mif: MifStep1DataIntegrityAssessment | null,
): MifShadowDimensionResult {
  if (!mif) {
    return {
      dimension: "candle_integrity",
      outcome: "insufficient_evidence",
      phase2Status: phase2.status,
      mifStatus: null,
      phase2Evidence: `errors=${phase2.errors.length}`,
      mifEvidence: null,
      disagreementCode: null,
      explanation: "MIF data-integrity assessment not supplied",
    };
  }
  const p2Hard =
    phase2.errors.some((e) =>
      ["INVALID_OHLC", "DUPLICATE_CANDLE", "OUT_OF_ORDER", "INVALID_TIMESTAMP"].includes(e.code),
    );
  const mifHard = mif.status === "BLOCKED" && mif.blockingCodes.length > 0;
  if (!p2Hard && mif.status === "VALID") {
    return {
      dimension: "candle_integrity",
      outcome: "equivalent",
      phase2Status: phase2.status,
      mifStatus: mif.status,
      phase2Evidence: "no hard OHLC/order errors",
      mifEvidence: mif.diagnosticsSummary,
      disagreementCode: null,
      explanation: "both systems report no hard candle integrity failure",
    };
  }
  if (p2Hard && mifHard) {
    return {
      dimension: "candle_integrity",
      outcome: "compatible_different",
      phase2Status: phase2.status,
      mifStatus: mif.status,
      phase2Evidence: phase2.errors.map((e) => e.code).join(","),
      mifEvidence: mif.blockingCodes.join(","),
      disagreementCode: null,
      explanation: "both flag hard candle integrity issues under different vocabularies",
    };
  }
  if (p2Hard !== mifHard) {
    return {
      dimension: "candle_integrity",
      outcome: "genuine_disagreement",
      phase2Status: phase2.status,
      mifStatus: mif.status,
      phase2Evidence: phase2.errors.map((e) => e.code).join(",") || "none",
      mifEvidence: mif.blockingCodes.join(",") || mif.status,
      disagreementCode: "SHADOW_CANDLE_INTEGRITY_DISAGREE",
      explanation: "hard integrity failure present in only one system",
    };
  }
  return {
    dimension: "candle_integrity",
    outcome: "compatible_different",
    phase2Status: phase2.status,
    mifStatus: mif.status,
    phase2Evidence: phase2.status,
    mifEvidence: mif.status,
    disagreementCode: null,
    explanation: "statuses differ but no opposing hard-integrity polarity",
  };
}

export function compareCoverage(
  phase2: HfmAnalysisDataQualityReport,
  mif: MifStep1DataIntegrityAssessment | null,
): MifShadowDimensionResult {
  if (!mif) {
    return {
      dimension: "coverage",
      outcome: "insufficient_evidence",
      phase2Status: phase2.status,
      mifStatus: null,
      phase2Evidence: phase2HasErrorCode(phase2, "INSUFFICIENT_CANDLES") ? "INSUFFICIENT_CANDLES" : null,
      mifEvidence: null,
      disagreementCode: null,
      explanation: "MIF coverage not available",
    };
  }
  const p2Insuff = phase2HasErrorCode(phase2, "INSUFFICIENT_CANDLES");
  const mifInsuff = mif.gapCounters.insufficientHistoryCount > 0 ||
    mif.coverage.satisfiesExplicitRequirement === false;
  if (p2Insuff && !mifInsuff) {
    return {
      dimension: "coverage",
      outcome: "phase2_additional_evidence",
      phase2Status: phase2.status,
      mifStatus: mif.status,
      phase2Evidence: "INSUFFICIENT_CANDLES",
      mifEvidence: `valid=${mif.coverage.validCandleCount}; explicitReq=${String(mif.coverage.satisfiesExplicitRequirement)}`,
      disagreementCode: null,
      explanation:
        "Phase 2 applies minCandlesPerTf=30; MIF only flags insufficient history when an explicit consumer requirement was supplied",
    };
  }
  if (!p2Insuff && mifInsuff) {
    return {
      dimension: "coverage",
      outcome: "mif_additional_evidence",
      phase2Status: phase2.status,
      mifStatus: mif.status,
      phase2Evidence: null,
      mifEvidence: "explicit consumer coverage unmet",
      disagreementCode: null,
      explanation: "MIF reports explicit coverage shortfall; Phase 2 did not emit INSUFFICIENT_CANDLES",
    };
  }
  return {
    dimension: "coverage",
    outcome: p2Insuff === mifInsuff ? "equivalent" : "compatible_different",
    phase2Status: phase2.status,
    mifStatus: mif.status,
    phase2Evidence: p2Insuff ? "INSUFFICIENT_CANDLES" : "ok",
    mifEvidence: `valid=${mif.coverage.validCandleCount}`,
    disagreementCode: null,
    explanation: "coverage interpretations aligned for available evidence",
  };
}

export function compareGaps(
  phase2: HfmAnalysisDataQualityReport,
  mif: MifStep1DataIntegrityAssessment | null,
): MifShadowDimensionResult {
  if (!mif) {
    return {
      dimension: "gaps",
      outcome: "insufficient_evidence",
      phase2Status: phase2.status,
      mifStatus: null,
      phase2Evidence: null,
      mifEvidence: null,
      disagreementCode: null,
      explanation: "MIF gap counters unavailable",
    };
  }
  const p2GapWarn =
    phase2HasErrorCode(phase2, "UNKNOWN_GAP") ||
    phase2HasErrorCode(phase2, "POSSIBLE_SESSION_GAP") ||
    phase2HasErrorCode(phase2, "HIGH_GAP_RATIO");
  const mifGaps =
    mif.gapCounters.possibleMissingCount +
      mif.gapCounters.unknownSessionGapCount +
      mif.gapCounters.confirmedMissingCount >
    0;
  if (!p2GapWarn && mifGaps) {
    return {
      dimension: "gaps",
      outcome: "mif_additional_evidence",
      phase2Status: phase2.status,
      mifStatus: mif.status,
      phase2Evidence: "Phase2 missingApprox inert / gap warnings may be absent",
      mifEvidence: JSON.stringify(mif.gapCounters),
      disagreementCode: null,
      explanation: "MIF classifies gaps with separate counters; Phase 2 HIGH_GAP_RATIO remains inert",
    };
  }
  return {
    dimension: "gaps",
    outcome: "compatible_different",
    phase2Status: phase2.status,
    mifStatus: mif.status,
    phase2Evidence: p2GapWarn ? "gap-warnings" : "none",
    mifEvidence: JSON.stringify(mif.gapCounters),
    disagreementCode: null,
    explanation: "gap dimensions use different models; neither invents confirmed session missing without calendar",
  };
}

export function compareQuoteFreshness(
  phase2: HfmAnalysisDataQualityReport,
  quote: MifQuoteQualityAssessment | null,
): MifShadowDimensionResult {
  if (!quote) {
    return {
      dimension: "quote_freshness",
      outcome: "insufficient_evidence",
      phase2Status: phase2.status,
      mifStatus: null,
      phase2Evidence: phase2.status,
      mifEvidence: null,
      disagreementCode: null,
      explanation: "MIF quote assessment not supplied",
    };
  }
  const p2Stale = phase2.status === "STALE" || phase2HasErrorCode(phase2, "STALE_QUOTE");
  const p2Delayed = phase2HasErrorCode(phase2, "DELAYED_QUOTE") || phase2.status === "DEGRADED";
  if (quote.freshness === "UNKNOWN") {
    return {
      dimension: "quote_freshness",
      outcome: "incomparable",
      phase2Status: phase2.status,
      mifStatus: quote.status,
      phase2Evidence: phase2.status,
      mifEvidence: `freshness=${quote.freshness}; method=${quote.clockComparability?.method ?? "n/a"}`,
      disagreementCode: "SHADOW_QUOTE_FRESHNESS_INCOMPARABLE",
      explanation: "MIF refused freshness claim due to clock-domain uncertainty; Phase 2 may still age broker ts vs wall clock",
    };
  }
  if (p2Stale && quote.freshness === "STALE") {
    return {
      dimension: "quote_freshness",
      outcome: "equivalent",
      phase2Status: phase2.status,
      mifStatus: quote.status,
      phase2Evidence: "STALE",
      mifEvidence: `STALE age=${quote.ageSec}`,
      disagreementCode: null,
      explanation: "both classify quote as stale under their models",
    };
  }
  if ((p2Stale || p2Delayed) !== (quote.freshness === "STALE" || quote.freshness === "DELAYED")) {
    return {
      dimension: "quote_freshness",
      outcome: "genuine_disagreement",
      phase2Status: phase2.status,
      mifStatus: quote.status,
      phase2Evidence: phase2.status,
      mifEvidence: quote.freshness,
      disagreementCode: "SHADOW_QUOTE_FRESHNESS_DISAGREE",
      explanation: "freshness polarity differs between Phase 2 and MIF",
    };
  }
  return {
    dimension: "quote_freshness",
    outcome: "compatible_different",
    phase2Status: phase2.status,
    mifStatus: quote.status,
    phase2Evidence: phase2.status,
    mifEvidence: quote.freshness,
    disagreementCode: null,
    explanation: "freshness classifications compatible under different vocabularies",
  };
}

export function compareSynchronization(
  phase2Sync: HfmAnalysisSyncReport | null | undefined,
  mtf: MifMultiTimeframeQualityAssessment | null,
): MifShadowDimensionResult {
  if (!mtf && !phase2Sync) {
    return {
      dimension: "synchronization",
      outcome: "insufficient_evidence",
      phase2Status: null,
      mifStatus: null,
      phase2Evidence: null,
      mifEvidence: null,
      disagreementCode: null,
      explanation: "neither Phase 2 sync nor MIF multi-tf assessment supplied",
    };
  }
  if (!mtf) {
    return {
      dimension: "synchronization",
      outcome: "phase2_additional_evidence",
      phase2Status: phase2Sync?.status ?? null,
      mifStatus: null,
      phase2Evidence: phase2Sync ? `missing=${phase2Sync.timeframesMissing.join(",")}` : null,
      mifEvidence: null,
      disagreementCode: null,
      explanation: "only Phase 2 sync present",
    };
  }
  if (!phase2Sync) {
    return {
      dimension: "synchronization",
      outcome: "mif_additional_evidence",
      phase2Status: null,
      mifStatus: mtf.status,
      phase2Evidence: null,
      mifEvidence: `alignment=${mtf.alignment}; skew=${mtf.measuredSkewSec}`,
      disagreementCode: null,
      explanation: "MIF measures skew without universalizing Phase 2 6h SYNC_TIP_DIVERGENCE",
    };
  }
  if (mtf.alignment === "incomparable") {
    return {
      dimension: "synchronization",
      outcome: "incomparable",
      phase2Status: phase2Sync.status,
      mifStatus: mtf.status,
      phase2Evidence: phase2Sync.status,
      mifEvidence: mtf.alignment,
      disagreementCode: "SHADOW_SYNC_INCOMPARABLE",
      explanation: "MIF refuses mixed clock-domain tip subtraction",
    };
  }
  return {
    dimension: "synchronization",
    outcome: "compatible_different",
    phase2Status: phase2Sync.status,
    mifStatus: mtf.status,
    phase2Evidence: phase2Sync.status,
    mifEvidence: `alignment=${mtf.alignment}; skew=${mtf.measuredSkewSec}; threshold=${mtf.maxTipSkewSec}`,
    disagreementCode: null,
    explanation: "sync compared without equating Phase 2 6h heuristic to MIF measured skew",
  };
}

export function compareOverallInterpretation(
  phase2: HfmAnalysisDataQualityReport,
  mifOverall: string | null,
): MifShadowDimensionResult {
  if (!mifOverall) {
    return {
      dimension: "overall_interpretation",
      outcome: "insufficient_evidence",
      phase2Status: phase2.status,
      mifStatus: null,
      phase2Evidence: `approvedForAiReasoning=${phase2.approvedForAiReasoning}`,
      mifEvidence: null,
      disagreementCode: null,
      explanation: "unified MIF overall status not supplied to shadow bridge",
    };
  }
  // Do NOT equate Phase2 VALID with MIF VALID as AI-approval equivalence.
  if (phase2.status === "VALID" && mifOverall === "VALID") {
    return {
      dimension: "overall_interpretation",
      outcome: "compatible_different",
      phase2Status: phase2.status,
      mifStatus: mifOverall,
      phase2Evidence: `approvedForAiReasoning=${phase2.approvedForAiReasoning}`,
      mifEvidence: "MIF VALID does not approve AI",
      disagreementCode: null,
      explanation:
        "both VALID under their vocabularies; Phase 2 AI gate remains authoritative and unchanged",
    };
  }
  if (
    (phase2.status === "INVALID" || phase2.status === "INCOMPLETE") &&
    mifOverall === "BLOCKED"
  ) {
    return {
      dimension: "overall_interpretation",
      outcome: "compatible_different",
      phase2Status: phase2.status,
      mifStatus: mifOverall,
      phase2Evidence: phase2.status,
      mifEvidence: mifOverall,
      disagreementCode: null,
      explanation: "failure-class statuses aligned without direct enum equality",
    };
  }
  if (phase2.status === "VALID" && mifOverall === "BLOCKED") {
    return {
      dimension: "overall_interpretation",
      outcome: "genuine_disagreement",
      phase2Status: phase2.status,
      mifStatus: mifOverall,
      phase2Evidence: `approvedForAiReasoning=${phase2.approvedForAiReasoning}`,
      mifEvidence: mifOverall,
      disagreementCode: "SHADOW_OVERALL_DISAGREE",
      explanation: "Phase 2 VALID vs MIF BLOCKED — observational only; Phase 2 gate untouched",
    };
  }
  return {
    dimension: "overall_interpretation",
    outcome: "compatible_different",
    phase2Status: phase2.status,
    mifStatus: mifOverall,
    phase2Evidence: phase2.status,
    mifEvidence: mifOverall,
    disagreementCode: null,
    explanation: "overall statuses differ; shadow bridge does not mutate either system",
  };
}

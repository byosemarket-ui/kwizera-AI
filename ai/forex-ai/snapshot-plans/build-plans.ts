/**
 * Build Pullback + Breakout plans from snapshot structure + analysis (deterministic).
 */
import { randomUUID } from "node:crypto";
import type { AnalysisMarketSnapshot } from "../../market-data/analysis-snapshot/types.js";
import {
  classifyMarketDirection,
  confidenceDisplay,
  directionMeaning,
} from "./direction.js";
import { evaluatePlanLifecycle } from "./lifecycle.js";
import {
  buildStructureEvidenceFromSnapshot,
  resolveReferencePrice,
} from "./structure-from-snapshot.js";
import type {
  SnapshotMarketDirection,
  SnapshotPlanBundle,
  SnapshotPlanIntent,
  SnapshotPlanKind,
  SnapshotPriceZone,
  SnapshotStructureEvidenceSummary,
  SnapshotTradePlan,
} from "./types.js";
import { SNAPSHOT_TRADE_PLANS_SCHEMA } from "./types.js";
import { computeRiskReward, sanitizePlanConsistency } from "./validate-plan.js";

type AnalysisLike = {
  analysisId: string;
  snapshotId: string;
  contentFingerprint: string;
  instrument: string;
  candleTimeframe: string;
  analysisPeriod: string;
  marketBias: string;
  decision: string;
  decisionRationale: string;
  keyEvidence: string[];
  invalidationConditions: string[];
  confidence: string | null;
  limitations: string[];
  warnings: string[];
  status: string;
  error: string | null;
};

function emptyZone(reason: string): SnapshotPriceZone {
  return {
    lower: null,
    upper: null,
    reference: null,
    rationale: "",
    unavailableReason: reason,
  };
}

function zoneFromSwing(input: {
  kind: SnapshotPlanKind;
  direction: SnapshotMarketDirection;
  structure: SnapshotStructureEvidenceSummary;
}): SnapshotPriceZone {
  const hi = input.structure.lastSwingHigh;
  const lo = input.structure.lastSwingLow;
  if (hi == null || lo == null || !(hi > lo)) {
    return emptyZone(
      "Entry zone unavailable — confirmed swing high/low not present in detector evidence.",
    );
  }

  const support = input.structure.zones.find((z) => z.side === "SUPPORT" && z.status === "ACTIVE");
  const resistance = input.structure.zones.find((z) => z.side === "RESISTANCE" && z.status === "ACTIVE");

  if (input.kind === "PULLBACK") {
    if (input.direction === "BULLISH") {
      const lower = support?.low ?? lo;
      const upper = support?.high ?? (lo + (hi - lo) * 0.25);
      return {
        lower,
        upper,
        reference: (lower + upper) / 2,
        rationale:
          "Bullish pullback zone near last swing low / active support. Requires bullish confirmation after the zone is reached.",
        unavailableReason: null,
      };
    }
    if (input.direction === "BEARISH") {
      const lower = resistance?.low ?? (hi - (hi - lo) * 0.25);
      const upper = resistance?.high ?? hi;
      return {
        lower,
        upper,
        reference: (lower + upper) / 2,
        rationale:
          "Bearish pullback zone near last swing high / active resistance. Requires bearish confirmation after the zone is reached.",
        unavailableReason: null,
      };
    }
    return emptyZone(
      "Pullback entry zone not derived for SIDEWAYS/UNCERTAIN markets without clearer directional structure.",
    );
  }

  // BREAKOUT
  if (input.direction === "BULLISH" || input.direction === "SIDEWAYS") {
    const lower = resistance?.low ?? hi;
    const upper = resistance?.high ?? hi;
    return {
      lower,
      upper,
      reference: hi,
      rationale:
        "Breakout watch above resistance / last swing high. Acceptance beyond the level is required — a wick alone is not confirmation.",
      unavailableReason: null,
    };
  }
  if (input.direction === "BEARISH") {
    const lower = support?.low ?? lo;
    const upper = support?.high ?? lo;
    return {
      lower,
      upper,
      reference: lo,
      rationale:
        "Breakdown watch below support / last swing low. Acceptance beyond the level is required.",
      unavailableReason: null,
    };
  }
  return emptyZone("Breakout zone unavailable — direction UNCERTAIN.");
}

function planIntent(input: {
  kind: SnapshotPlanKind;
  direction: SnapshotMarketDirection;
  decision: string;
  analysisFailed: boolean;
}): SnapshotPlanIntent {
  if (input.analysisFailed) return "UNSUITABLE";
  if (input.direction === "UNCERTAIN") return "WAIT";
  if (input.direction === "SIDEWAYS") {
    return input.kind === "BREAKOUT" ? "WAIT" : "WAIT";
  }
  if (input.kind === "PULLBACK") {
    if (input.direction === "BULLISH") return "BUY";
    if (input.direction === "BEARISH") return "SELL";
  }
  if (input.kind === "BREAKOUT") {
    if (input.direction === "BULLISH") return "BUY";
    if (input.direction === "BEARISH") return "SELL";
  }
  return "WAIT";
}

function buildOnePlan(input: {
  kind: SnapshotPlanKind;
  provider: "LOCAL" | "OPENAI";
  analysis: AnalysisLike;
  direction: SnapshotMarketDirection;
  structure: SnapshotStructureEvidenceSummary;
  currentPrice: number | null;
  createdAt: string;
}): SnapshotTradePlan {
  const analysisFailed =
    input.analysis.status === "failed"
    || Boolean(input.analysis.error)
    || input.analysis.decision === "NO_TRADE";

  const intent = planIntent({
    kind: input.kind,
    direction: input.direction,
    decision: input.analysis.decision,
    analysisFailed,
  });

  const entryZone = intent === "WAIT" || intent === "UNSUITABLE"
    ? emptyZone(
      intent === "UNSUITABLE"
        ? "Plan unsuitable — analysis failed or evidence insufficient."
        : "WAIT — market direction/evidence does not support a directional entry zone.",
    )
    : zoneFromSwing({
      kind: input.kind,
      direction: input.direction,
      structure: input.structure,
    });

  const unsuitableReasons: string[] = [];
  if (analysisFailed) unsuitableReasons.push(input.analysis.error || "Analysis failed.");
  if (!input.structure.dataUsable) {
    unsuitableReasons.push(
      input.structure.warnings[0]
      ?? "Instrument data not fully usable for trade planning.",
    );
  }
  if (entryZone.unavailableReason) unsuitableReasons.push(entryZone.unavailableReason);
  if (input.direction === "UNCERTAIN") {
    unsuitableReasons.push("Market direction UNCERTAIN — directional plan withheld.");
  }

  let stop: number | null = null;
  let targets: number[] = [];
  let stopRationale = "";
  let stopUnavailable: string | null = null;
  let tpRationale = "";
  let tpUnavailable: string | null = null;

  const hi = input.structure.lastSwingHigh;
  const lo = input.structure.lastSwingLow;

  if (intent === "BUY" && entryZone.reference != null && lo != null && hi != null) {
    stop = lo;
    stopRationale = "Stop below last swing low / structure invalidation.";
    targets = [hi];
    tpRationale = "Target toward last swing high / opposite structure.";
  } else if (intent === "SELL" && entryZone.reference != null && lo != null && hi != null) {
    stop = hi;
    stopRationale = "Stop above last swing high / structure invalidation.";
    targets = [lo];
    tpRationale = "Target toward last swing low / opposite structure.";
  } else {
    stopUnavailable = "Stop loss not derived — missing swing structure or non-directional intent.";
    tpUnavailable = "Take profit not derived — missing swing structure or non-directional intent.";
  }

  const rr = computeRiskReward({
    entry: entryZone.reference,
    stop,
    target: targets[0] ?? null,
  });

  const confirmationRequired: string[] = [];
  if (intent === "BUY") {
    confirmationRequired.push(
      input.kind === "PULLBACK"
        ? "Bullish rejection / higher-low acceptance inside the pullback zone after it is reached."
        : "Close/acceptance above breakout level with confirmatory bullish structure (e.g. BOS).",
    );
  } else if (intent === "SELL") {
    confirmationRequired.push(
      input.kind === "PULLBACK"
        ? "Bearish rejection / lower-high acceptance inside the pullback zone after it is reached."
        : "Close/acceptance below breakdown level with confirmatory bearish structure (e.g. BOS).",
    );
  }

  const base = {
    schemaVersion: SNAPSHOT_TRADE_PLANS_SCHEMA,
    planId: randomUUID(),
    planKind: input.kind,
    version: 1 as const,
    analysisProvider: input.provider,
    analysisId: input.analysis.analysisId,
    snapshotId: input.analysis.snapshotId,
    contentFingerprint: input.analysis.contentFingerprint,
    instrument: input.analysis.instrument,
    candleTimeframe: input.analysis.candleTimeframe,
    analysisPeriod: input.analysis.analysisPeriod,
    marketDirection: input.direction,
    intent,
    entryZone,
    confirmationRequired,
    stopLoss: {
      price: stop,
      rationale: stopRationale,
      unavailableReason: stopUnavailable,
    },
    takeProfit: {
      prices: targets,
      rationale: tpRationale,
      unavailableReason: tpUnavailable,
    },
    invalidationConditions: [
      ...input.analysis.invalidationConditions.slice(0, 4),
      ...(stop != null ? [`Structural invalidation near ${stop}`] : []),
    ],
    expiryConditions: [
      "Expires if a newer snapshot replaces this analysis context.",
      "Expires if quote/structure data becomes unavailable before confirmation.",
    ],
    riskReward: {
      ratio: rr.ratio,
      risk: rr.risk,
      reward: rr.reward,
      unavailableReason: rr.unavailableReason,
    },
    spreadNote:
      "Spread/trading costs are not computed in Phase 44 — see future position-sizing phase.",
    dataQualityLimitations: [
      ...input.analysis.limitations.slice(0, 3),
      ...input.structure.warnings.slice(0, 3),
      ...(input.structure.quoteFreshness
        ? [`Quote freshness: ${input.structure.quoteFreshness}`]
        : ["Quote freshness unavailable"]),
    ],
    unsuitableReasons,
    createdAt: input.createdAt,
  };

  const life = evaluatePlanLifecycle({
    plan: base as never,
    currentPrice: input.currentPrice,
    structure: input.structure,
    materialConflict: false,
  });

  return sanitizePlanConsistency({
    ...base,
    ...life,
  });
}

export function buildSnapshotPlanBundle(input: {
  analysis: AnalysisLike;
  snapshot: AnalysisMarketSnapshot;
  provider: "LOCAL" | "OPENAI";
}): SnapshotPlanBundle {
  const createdAt = new Date().toISOString();
  const structure = buildStructureEvidenceFromSnapshot(input.snapshot);
  const { direction, explanation } = classifyMarketDirection({
    marketBias: input.analysis.marketBias,
    decision: input.analysis.decision,
    structure,
    keyEvidence: input.analysis.keyEvidence,
  });
  const currentPrice = resolveReferencePrice(input.snapshot);

  const pullback = buildOnePlan({
    kind: "PULLBACK",
    provider: input.provider,
    analysis: input.analysis,
    direction,
    structure,
    currentPrice,
    createdAt,
  });
  const breakout = buildOnePlan({
    kind: "BREAKOUT",
    provider: input.provider,
    analysis: input.analysis,
    direction,
    structure,
    currentPrice,
    createdAt,
  });

  return {
    schemaVersion: SNAPSHOT_TRADE_PLANS_SCHEMA,
    marketDirection: direction,
    directionExplanation: explanation,
    directionMeaning: directionMeaning(direction),
    structureEvidence: structure,
    pullback,
    breakout,
    confidenceDisplay: confidenceDisplay(input.analysis.confidence),
    createdAt,
  };
}

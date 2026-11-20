/**
 * Phase 5D Step 1 — immutable initial strategy catalog (ten strategies @1.0.0).
 * Definitions describe eligibility for future detectors — not opportunities.
 */
import { MIF_STRATEGY_INTELLIGENCE_POLICY_VERSION } from "./contracts.js";
import { evidenceReq } from "./evidence.js";
import type { MifStrategyDefinition, MifStrategyId } from "./types.js";

const POLICY = MIF_STRATEGY_INTELLIGENCE_POLICY_VERSION;

function baseSafety(): Pick<
  MifStrategyDefinition,
  | "placesOrders"
  | "mutatesBroker"
  | "acceptsForExecution"
  | "doesNotApproveAiReasoning"
  | "doesNotCreateOpportunities"
  | "policyVersion"
  | "definitionVersion"
  | "lifecycleStatus"
  | "dataQualityMinStatus"
> {
  return {
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    doesNotCreateOpportunities: true,
    policyVersion: POLICY,
    definitionVersion: "1.0.0",
    lifecycleStatus: "ACTIVE",
    dataQualityMinStatus: "WARNING",
  };
}

export const MIF_STRATEGY_TREND_CONTINUATION: MifStrategyDefinition = {
  ...baseSafety(),
  strategyId: "TREND_CONTINUATION",
  name: "Trend Continuation",
  description: "Evaluate continuation of an established directional market structure.",
  purpose: "Identify opportunities where an established directional market structure continues.",
  categories: ["TREND_FOLLOWING"],
  requiredEvidence: [
    evidenceReq({
      evidenceId: "tc.regime",
      family: "MARKET_REGIME",
      mode: "REQUIRED",
      timeframeRoles: ["PRIMARY_DIRECTION", "INTERMEDIATE_STRUCTURE"],
      requireClosedCandle: false,
      notes: "Requires TRENDING structure with clear UP/DOWN direction.",
    }),
    evidenceReq({
      evidenceId: "tc.mtf",
      family: "MULTI_TIMEFRAME_RELATIONSHIP",
      mode: "REQUIRED",
      timeframeRoles: ["PRIMARY_DIRECTION", "SETUP_DEVELOPMENT"],
      notes: "Prefer ALIGNMENT or PARTIAL_ALIGNMENT; CONFLICT fails unless policy later allows.",
    }),
    evidenceReq({
      evidenceId: "tc.quality",
      family: "DATA_QUALITY",
      mode: "REQUIRED",
      missingAffects: "INELIGIBLE",
    }),
    evidenceReq({
      evidenceId: "tc.structure",
      family: "MARKET_STRUCTURE",
      mode: "REQUIRED",
      timeframeRoles: ["INTERMEDIATE_STRUCTURE"],
      availabilityOverride: "PARTIAL",
    }),
  ],
  optionalEvidence: [
    evidenceReq({
      evidenceId: "tc.candle_confirm",
      family: "CANDLE_CONFIRMATION",
      mode: "OPTIONAL",
      requireClosedCandle: true,
      missingAffects: "WARNING",
    }),
    evidenceReq({
      evidenceId: "tc.fib",
      family: "FIBONACCI",
      mode: "OPTIONAL",
      missingAffects: "IGNORE",
    }),
  ],
  regimeCompatibility: {
    directions: ["UP", "DOWN"],
    structures: ["TRENDING"],
    volatilities: ["LOW", "NORMAL", "HIGH"],
    rejectUnknown: true,
    notes: "Continuation requires a known trending direction; EXTREME vol allowed only as optional caution.",
  },
  timeframeRoles: [
    {
      role: "PRIMARY_DIRECTION",
      mode: "REQUIRED",
      typicalTimeframes: ["H4", "D1"],
      notes: "Higher-TF directional context.",
    },
    {
      role: "INTERMEDIATE_STRUCTURE",
      mode: "REQUIRED",
      typicalTimeframes: ["H1", "M30"],
      notes: "Intermediate structure alignment.",
    },
    {
      role: "SETUP_DEVELOPMENT",
      mode: "OPTIONAL",
      typicalTimeframes: ["M15", "M5"],
      notes: "Lower-TF continuation development.",
    },
    {
      role: "OPTIONAL_ENTRY_REFINEMENT",
      mode: "OPTIONAL",
      typicalTimeframes: ["M1"],
      notes: "M1 optional; missing must not invalidate definition.",
    },
  ],
  confirmations: [
    {
      confirmationId: "tc.closed_continuation",
      description: "Closed candle(s) continuing in trend direction after structure confirmation.",
      requireClosedCandle: true,
      notes: "FORMING candles never confirm.",
    },
  ],
  invalidations: [
    {
      invalidationId: "tc.structure_break",
      description: "Closed break against trend structure / CHoCH opposing the continuation thesis.",
      notes: "Distinct from a shallow pullback.",
    },
  ],
  knownLimitations: [
    "Does not emit opportunities in Phase 5D Step 1.",
    "Market structure evidence is PARTIAL pending a dedicated MIF structure assessment.",
  ],
};

export const MIF_STRATEGY_PULLBACK: MifStrategyDefinition = {
  ...baseSafety(),
  strategyId: "PULLBACK",
  name: "Pullback",
  description: "Corrective movement against a higher-timeframe direction that may resume the trend.",
  purpose: "Identify corrective price movement against an established higher-timeframe direction.",
  categories: ["TREND_FOLLOWING", "COUNTERTREND"],
  requiredEvidence: [
    evidenceReq({
      evidenceId: "pb.regime",
      family: "MARKET_REGIME",
      mode: "REQUIRED",
      timeframeRoles: ["PRIMARY_DIRECTION"],
    }),
    evidenceReq({
      evidenceId: "pb.mtf",
      family: "MULTI_TIMEFRAME_RELATIONSHIP",
      mode: "REQUIRED",
      timeframeRoles: ["PRIMARY_DIRECTION", "OPPORTUNITY_FORMATION"],
      notes: "COUNTERTREND_PULLBACK relation is preferred evidence for this strategy.",
    }),
    evidenceReq({
      evidenceId: "pb.quality",
      family: "DATA_QUALITY",
      mode: "REQUIRED",
      missingAffects: "INELIGIBLE",
    }),
  ],
  optionalEvidence: [
    evidenceReq({
      evidenceId: "pb.fib",
      family: "FIBONACCI",
      mode: "OPTIONAL",
      timeframeRoles: ["SETUP_DEVELOPMENT"],
      missingAffects: "WARNING",
    }),
    evidenceReq({
      evidenceId: "pb.structure",
      family: "MARKET_STRUCTURE",
      mode: "OPTIONAL",
      availabilityOverride: "PARTIAL",
      missingAffects: "WARNING",
    }),
  ],
  regimeCompatibility: {
    directions: ["UP", "DOWN"],
    structures: ["TRENDING", "TRANSITION"],
    volatilities: ["LOW", "NORMAL", "HIGH"],
    rejectUnknown: true,
    notes: "Pullback ≠ confirmed reversal; higher-TF trend should remain intact.",
  },
  timeframeRoles: [
    {
      role: "PRIMARY_DIRECTION",
      mode: "REQUIRED",
      typicalTimeframes: ["H4", "D1"],
      notes: "Dominant direction.",
    },
    {
      role: "OPPORTUNITY_FORMATION",
      mode: "REQUIRED",
      typicalTimeframes: ["M15", "M5"],
      notes: "Corrective lower-TF structure.",
    },
    {
      role: "INTERMEDIATE_STRUCTURE",
      mode: "OPTIONAL",
      typicalTimeframes: ["H1", "M30"],
      notes: "Intermediate still agreeing with higher supports pullback vs reversal.",
    },
    {
      role: "OPTIONAL_ENTRY_REFINEMENT",
      mode: "OPTIONAL",
      typicalTimeframes: ["M1"],
      notes: "Optional M1.",
    },
  ],
  confirmations: [
    {
      confirmationId: "pb.resume_closed",
      description: "Closed evidence of trend resumption after corrective structure.",
      requireClosedCandle: true,
      notes: "Must not treat reverse-colored single candle as confirmation.",
    },
  ],
  invalidations: [
    {
      invalidationId: "pb.becomes_reversal",
      description: "Higher-TF structure breaks / MTF relation shifts to POTENTIAL_REVERSAL with confirming evidence.",
      notes: "Explicitly distinguishes pullback from reversal.",
    },
  ],
  knownLimitations: [
    "Eligibility does not confirm pullback completion.",
    "Does not invent institutional order-flow.",
  ],
};

export const MIF_STRATEGY_REVERSAL: MifStrategyDefinition = {
  ...baseSafety(),
  strategyId: "REVERSAL",
  name: "Reversal",
  description: "Potential structural change in market direction.",
  purpose: "Identify potential structural changes in market direction.",
  categories: ["COUNTERTREND", "PATTERN_BASED"],
  requiredEvidence: [
    evidenceReq({
      evidenceId: "rv.regime",
      family: "MARKET_REGIME",
      mode: "REQUIRED",
      timeframeRoles: ["PRIMARY_DIRECTION", "INTERMEDIATE_STRUCTURE"],
      notes: "TRANSITION/UNSTABLE or opposing lower-TF trends are relevant.",
    }),
    evidenceReq({
      evidenceId: "rv.mtf",
      family: "MULTI_TIMEFRAME_RELATIONSHIP",
      mode: "REQUIRED",
      notes: "POTENTIAL_REVERSAL / TRANSITION relations are preferred.",
    }),
    evidenceReq({
      evidenceId: "rv.structure",
      family: "MARKET_STRUCTURE",
      mode: "REQUIRED",
      availabilityOverride: "PARTIAL",
      notes: "Requires structural change evidence (e.g. CHoCH/BOS) when available — not a single opposite candle.",
    }),
    evidenceReq({
      evidenceId: "rv.quality",
      family: "DATA_QUALITY",
      mode: "REQUIRED",
      missingAffects: "INELIGIBLE",
    }),
  ],
  optionalEvidence: [
    evidenceReq({
      evidenceId: "rv.geometric",
      family: "GEOMETRIC_PATTERN",
      mode: "OPTIONAL",
      missingAffects: "WARNING",
    }),
    evidenceReq({
      evidenceId: "rv.harmonic",
      family: "HARMONIC_PATTERN",
      mode: "OPTIONAL",
      missingAffects: "WARNING",
    }),
    evidenceReq({
      evidenceId: "rv.fib",
      family: "FIBONACCI",
      mode: "OPTIONAL",
      missingAffects: "IGNORE",
    }),
  ],
  regimeCompatibility: {
    directions: ["UP", "DOWN", "NEUTRAL", "UNKNOWN"],
    structures: ["TRANSITION", "UNSTABLE", "TRENDING", "BREAKOUT"],
    volatilities: ["NORMAL", "HIGH", "EXTREME", "LOW"],
    rejectUnknown: false,
    notes: "UNKNOWN direction allowed only with strong structural/pattern evidence in later detectors.",
  },
  timeframeRoles: [
    {
      role: "PRIMARY_DIRECTION",
      mode: "REQUIRED",
      typicalTimeframes: ["H4", "D1"],
      notes: "Context being challenged.",
    },
    {
      role: "INTERMEDIATE_STRUCTURE",
      mode: "REQUIRED",
      typicalTimeframes: ["H1", "M30"],
      notes: "Structural transition evidence.",
    },
    {
      role: "LOWER_TIMEFRAME_CONFIRMATION",
      mode: "OPTIONAL",
      typicalTimeframes: ["M15", "M5"],
      notes: "Confirmation only — not sole reversal proof.",
    },
  ],
  confirmations: [
    {
      confirmationId: "rv.structure_confirm",
      description: "Closed structural confirmation of direction change (not a single opposite candle).",
      requireClosedCandle: true,
      notes: "FORMING never confirms.",
    },
  ],
  invalidations: [
    {
      invalidationId: "rv.failed_structure",
      description: "Failed break / structure resumes prior trend with closed evidence.",
      notes: "",
    },
  ],
  knownLimitations: [
    "Not a simple candle-color reversal.",
    "Dedicated structure assessment contract still PARTIAL.",
  ],
};

export const MIF_STRATEGY_BREAKOUT: MifStrategyDefinition = {
  ...baseSafety(),
  strategyId: "BREAKOUT",
  name: "Breakout",
  description: "Potential movement beyond an established structural boundary.",
  purpose: "Identify potential movement beyond an established structural boundary.",
  categories: ["BREAKOUT"],
  requiredEvidence: [
    evidenceReq({
      evidenceId: "bo.regime",
      family: "MARKET_REGIME",
      mode: "REQUIRED",
      notes: "BREAKOUT structure or range→breakout development.",
    }),
    evidenceReq({
      evidenceId: "bo.boundary",
      family: "SUPPORT_RESISTANCE",
      mode: "REQUIRED",
      availabilityOverride: "PARTIAL",
    }),
    evidenceReq({
      evidenceId: "bo.displacement",
      family: "PRICE_DISPLACEMENT",
      mode: "REQUIRED",
      availabilityOverride: "AVAILABLE",
    }),
    evidenceReq({
      evidenceId: "bo.quality",
      family: "DATA_QUALITY",
      mode: "REQUIRED",
      missingAffects: "INELIGIBLE",
    }),
  ],
  optionalEvidence: [
    evidenceReq({
      evidenceId: "bo.vol",
      family: "VOLATILITY",
      mode: "OPTIONAL",
      missingAffects: "WARNING",
    }),
    evidenceReq({
      evidenceId: "bo.mtf",
      family: "MULTI_TIMEFRAME_RELATIONSHIP",
      mode: "OPTIONAL",
      missingAffects: "WARNING",
    }),
  ],
  regimeCompatibility: {
    directions: ["UP", "DOWN"],
    structures: ["BREAKOUT", "RANGING", "TRENDING", "TRANSITION"],
    volatilities: ["NORMAL", "HIGH", "EXTREME", "LOW"],
    rejectUnknown: true,
    notes: "Distinguish POTENTIAL vs CONFIRMED breakout in later detector.",
  },
  timeframeRoles: [
    {
      role: "INTERMEDIATE_STRUCTURE",
      mode: "REQUIRED",
      typicalTimeframes: ["H1", "H4"],
      notes: "Boundary context.",
    },
    {
      role: "OPPORTUNITY_FORMATION",
      mode: "REQUIRED",
      typicalTimeframes: ["M15", "M5"],
      notes: "Breakout formation TF.",
    },
  ],
  confirmations: [
    {
      confirmationId: "bo.closed_beyond",
      description: "CLOSED close beyond boundary with documented buffer — FORMING never confirms.",
      requireClosedCandle: true,
      notes: "Potential vs confirmed remains a detector concern.",
    },
  ],
  invalidations: [
    {
      invalidationId: "bo.failed_breakout",
      description: "Closed close back through boundary within failure window.",
      notes: "",
    },
  ],
  knownLimitations: [
    "S/R evidence is PARTIAL (structure zones / pattern boundaries).",
    "Does not treat a single wick as confirmed breakout.",
  ],
};

export const MIF_STRATEGY_BREAKOUT_RETEST: MifStrategyDefinition = {
  ...baseSafety(),
  strategyId: "BREAKOUT_RETEST",
  name: "Breakout Retest",
  description: "Breakout followed by a retest of the broken boundary.",
  purpose: "Identify a breakout followed by a retest of the broken boundary.",
  categories: ["BREAKOUT"],
  requiredEvidence: [
    evidenceReq({
      evidenceId: "brt.prior_breakout",
      family: "MARKET_REGIME",
      mode: "REQUIRED",
      notes: "Requires prior CONFIRMED breakout context — unconfirmed breakout is insufficient.",
    }),
    evidenceReq({
      evidenceId: "brt.boundary",
      family: "SUPPORT_RESISTANCE",
      mode: "REQUIRED",
      availabilityOverride: "PARTIAL",
    }),
    evidenceReq({
      evidenceId: "brt.candle",
      family: "CANDLE_CONFIRMATION",
      mode: "REQUIRED",
      requireClosedCandle: true,
      availabilityOverride: "PARTIAL",
    }),
    evidenceReq({
      evidenceId: "brt.quality",
      family: "DATA_QUALITY",
      mode: "REQUIRED",
      missingAffects: "INELIGIBLE",
    }),
  ],
  optionalEvidence: [
    evidenceReq({
      evidenceId: "brt.mtf",
      family: "MULTI_TIMEFRAME_RELATIONSHIP",
      mode: "OPTIONAL",
      missingAffects: "WARNING",
    }),
  ],
  regimeCompatibility: {
    directions: ["UP", "DOWN"],
    structures: ["BREAKOUT", "TRENDING", "TRANSITION"],
    volatilities: ["LOW", "NORMAL", "HIGH"],
    rejectUnknown: true,
    notes: "Retest of failed breakout is invalidation, not a setup.",
  },
  timeframeRoles: [
    {
      role: "INTERMEDIATE_STRUCTURE",
      mode: "REQUIRED",
      typicalTimeframes: ["H1", "H4"],
      notes: "Breakout boundary TF.",
    },
    {
      role: "OPPORTUNITY_FORMATION",
      mode: "REQUIRED",
      typicalTimeframes: ["M15", "M5"],
      notes: "Retest formation.",
    },
  ],
  confirmations: [
    {
      confirmationId: "brt.retest_hold",
      description: "Closed rejection/acceptance at broken boundary after confirmed breakout.",
      requireClosedCandle: true,
      notes: "Unconfirmed breakout cannot complete a retest setup.",
    },
  ],
  invalidations: [
    {
      invalidationId: "brt.boundary_reclaim",
      description: "Boundary fully reclaimed against breakout direction on closed evidence.",
      notes: "",
    },
  ],
  knownLimitations: [
    "Depends on prior breakout identity from a future detector / regime breakoutEvidence.",
  ],
};

export const MIF_STRATEGY_RANGE: MifStrategyDefinition = {
  ...baseSafety(),
  strategyId: "RANGE",
  name: "Range",
  description: "Opportunities within a well-defined range.",
  purpose: "Identify potential opportunities within a well-defined range.",
  categories: ["RANGE"],
  requiredEvidence: [
    evidenceReq({
      evidenceId: "rg.regime",
      family: "MARKET_REGIME",
      mode: "REQUIRED",
      notes: "RANGING structure required.",
    }),
    evidenceReq({
      evidenceId: "rg.range",
      family: "RANGE_STRUCTURE",
      mode: "REQUIRED",
      availabilityOverride: "PARTIAL",
    }),
    evidenceReq({
      evidenceId: "rg.quality",
      family: "DATA_QUALITY",
      mode: "REQUIRED",
      missingAffects: "INELIGIBLE",
    }),
  ],
  optionalEvidence: [
    evidenceReq({
      evidenceId: "rg.vol",
      family: "VOLATILITY",
      mode: "OPTIONAL",
      missingAffects: "WARNING",
    }),
    evidenceReq({
      evidenceId: "rg.mtf",
      family: "MULTI_TIMEFRAME_RELATIONSHIP",
      mode: "OPTIONAL",
      missingAffects: "IGNORE",
    }),
  ],
  regimeCompatibility: {
    directions: ["NEUTRAL", "UP", "DOWN"],
    structures: ["RANGING"],
    volatilities: ["LOW", "NORMAL"],
    rejectUnknown: true,
    notes: "HIGH/EXTREME volatility typically degrades range quality.",
  },
  timeframeRoles: [
    {
      role: "INTERMEDIATE_STRUCTURE",
      mode: "REQUIRED",
      typicalTimeframes: ["H1", "H4"],
      notes: "Range definition TF.",
    },
    {
      role: "SETUP_DEVELOPMENT",
      mode: "OPTIONAL",
      typicalTimeframes: ["M15", "M5"],
      notes: "Boundary reaction setups.",
    },
  ],
  confirmations: [
    {
      confirmationId: "rg.boundary_reject",
      description: "Repeated closed rejection near documented range boundaries.",
      requireClosedCandle: true,
      notes: "",
    },
  ],
  invalidations: [
    {
      invalidationId: "rg.range_break",
      description: "Confirmed closed breakout of range boundaries.",
      notes: "",
    },
  ],
  knownLimitations: ["Range boundaries sourced from regime rangeEvidence (PARTIAL)."],
};

export const MIF_STRATEGY_LIQUIDITY_SWEEP: MifStrategyDefinition = {
  ...baseSafety(),
  strategyId: "LIQUIDITY_SWEEP",
  name: "Liquidity Sweep",
  description: "Potential sweep of a previously established liquidity reference.",
  purpose: "Identify a potential sweep of a previously established liquidity reference.",
  categories: ["LIQUIDITY"],
  requiredEvidence: [
    evidenceReq({
      evidenceId: "ls.quality",
      family: "DATA_QUALITY",
      mode: "REQUIRED",
      missingAffects: "INELIGIBLE",
    }),
    evidenceReq({
      evidenceId: "ls.structure",
      family: "MARKET_STRUCTURE",
      mode: "REQUIRED",
      availabilityOverride: "PARTIAL",
      notes: "Swing/structure reference required; wick-alone is insufficient.",
    }),
    evidenceReq({
      evidenceId: "ls.candle",
      family: "CANDLE_CONFIRMATION",
      mode: "REQUIRED",
      requireClosedCandle: true,
      availabilityOverride: "PARTIAL",
    }),
  ],
  optionalEvidence: [
    evidenceReq({
      evidenceId: "ls.liquidity_ref",
      family: "LIQUIDITY_REFERENCE",
      mode: "OPTIONAL",
      availabilityOverride: "AVAILABLE",
      missingAffects: "WARNING",
      notes: "Phase 5D.6 dedicated liquidity reference engine — optional enrichment; does not claim resting orders.",
    }),
    evidenceReq({
      evidenceId: "ls.regime",
      family: "MARKET_REGIME",
      mode: "OPTIONAL",
      missingAffects: "WARNING",
    }),
  ],
  regimeCompatibility: {
    directions: ["UP", "DOWN", "NEUTRAL", "UNKNOWN"],
    structures: ["TRENDING", "RANGING", "TRANSITION", "UNSTABLE", "BREAKOUT"],
    volatilities: ["NORMAL", "HIGH", "EXTREME", "LOW"],
    rejectUnknown: false,
    notes: "Not every wick beyond a high/low is a confirmed sweep.",
  },
  timeframeRoles: [
    {
      role: "INTERMEDIATE_STRUCTURE",
      mode: "REQUIRED",
      typicalTimeframes: ["H1", "H4"],
      notes: "Liquidity reference TF.",
    },
    {
      role: "OPPORTUNITY_FORMATION",
      mode: "REQUIRED",
      typicalTimeframes: ["M15", "M5"],
      notes: "Sweep observation TF.",
    },
  ],
  confirmations: [
    {
      confirmationId: "ls.reject_closed",
      description: "Closed rejection/acceptance after excursion beyond reference.",
      requireClosedCandle: true,
      notes: "Wick-only without closed confirmation is not confirmation.",
    },
  ],
  invalidations: [
    {
      invalidationId: "ls.accepted_through",
      description: "Closed acceptance through the reference without rejection.",
      notes: "",
    },
  ],
  knownLimitations: [
    "LIQUIDITY_REFERENCE family is PLANNED — detectors must not fabricate liquidity pools.",
  ],
};

export const MIF_STRATEGY_SUPPLY_DEMAND: MifStrategyDefinition = {
  ...baseSafety(),
  strategyId: "SUPPLY_DEMAND",
  name: "Supply and Demand",
  description: "Potential supply/demand zones from defensible structural evidence.",
  purpose: "Identify potential supply and demand zones based on defensible structural evidence.",
  categories: ["SUPPLY_DEMAND"],
  requiredEvidence: [
    evidenceReq({
      evidenceId: "sd.structure",
      family: "MARKET_STRUCTURE",
      mode: "REQUIRED",
      availabilityOverride: "PARTIAL",
    }),
    evidenceReq({
      evidenceId: "sd.displacement",
      family: "PRICE_DISPLACEMENT",
      mode: "REQUIRED",
      availabilityOverride: "AVAILABLE",
    }),
    evidenceReq({
      evidenceId: "sd.quality",
      family: "DATA_QUALITY",
      mode: "REQUIRED",
      missingAffects: "INELIGIBLE",
    }),
  ],
  optionalEvidence: [
    evidenceReq({
      evidenceId: "sd.regime",
      family: "MARKET_REGIME",
      mode: "OPTIONAL",
      missingAffects: "WARNING",
    }),
    evidenceReq({
      evidenceId: "sd.boundary",
      family: "SUPPORT_RESISTANCE",
      mode: "OPTIONAL",
      availabilityOverride: "PARTIAL",
      missingAffects: "WARNING",
    }),
  ],
  regimeCompatibility: {
    directions: ["UP", "DOWN", "NEUTRAL"],
    structures: ["TRENDING", "RANGING", "TRANSITION", "BREAKOUT"],
    volatilities: ["LOW", "NORMAL", "HIGH"],
    rejectUnknown: true,
    notes: "No volume-based institutional activity is invented.",
  },
  timeframeRoles: [
    {
      role: "PRIMARY_DIRECTION",
      mode: "OPTIONAL",
      typicalTimeframes: ["H4", "D1"],
      notes: "Zone origin context.",
    },
    {
      role: "INTERMEDIATE_STRUCTURE",
      mode: "REQUIRED",
      typicalTimeframes: ["H1", "H4"],
      notes: "Zone definition.",
    },
    {
      role: "SETUP_DEVELOPMENT",
      mode: "OPTIONAL",
      typicalTimeframes: ["M15", "M5"],
      notes: "Return-to-zone setups.",
    },
  ],
  confirmations: [
    {
      confirmationId: "sd.zone_reaction",
      description: "Closed reaction at zone with documented displacement origin.",
      requireClosedCandle: true,
      notes: "",
    },
  ],
  invalidations: [
    {
      invalidationId: "sd.zone_mitigated",
      description: "Zone fully mitigated / broken with closed acceptance.",
      notes: "Freshness/mitigation state may be PLANNED in later detectors.",
    },
  ],
  knownLimitations: [
    "Does not invent volume-based institutional footprints.",
    "Zone freshness tracking deferred to later steps.",
  ],
};

export const MIF_STRATEGY_MOMENTUM_EXPANSION: MifStrategyDefinition = {
  ...baseSafety(),
  strategyId: "MOMENTUM_EXPANSION",
  name: "Momentum Expansion",
  description: "Directional expansion supported by measurable displacement and volatility.",
  purpose: "Identify meaningful directional expansion supported by measurable momentum and volatility evidence.",
  categories: ["MOMENTUM", "TREND_FOLLOWING"],
  requiredEvidence: [
    evidenceReq({
      evidenceId: "me.displacement",
      family: "PRICE_DISPLACEMENT",
      mode: "REQUIRED",
      availabilityOverride: "AVAILABLE",
    }),
    evidenceReq({
      evidenceId: "me.vol",
      family: "VOLATILITY",
      mode: "REQUIRED",
    }),
    evidenceReq({
      evidenceId: "me.regime",
      family: "MARKET_REGIME",
      mode: "REQUIRED",
    }),
    evidenceReq({
      evidenceId: "me.quality",
      family: "DATA_QUALITY",
      mode: "REQUIRED",
      missingAffects: "INELIGIBLE",
    }),
  ],
  optionalEvidence: [
    evidenceReq({
      evidenceId: "me.momentum",
      family: "MOMENTUM",
      mode: "OPTIONAL",
      availabilityOverride: "AVAILABLE",
      missingAffects: "WARNING",
      notes: "Phase 5D.6 ROC+RSI momentum assessment — not a win probability.",
    }),
    evidenceReq({
      evidenceId: "me.structure",
      family: "MARKET_STRUCTURE",
      mode: "OPTIONAL",
      availabilityOverride: "PARTIAL",
      missingAffects: "WARNING",
    }),
  ],
  regimeCompatibility: {
    directions: ["UP", "DOWN"],
    structures: ["TRENDING", "BREAKOUT", "TRANSITION"],
    volatilities: ["HIGH", "EXTREME", "NORMAL"],
    rejectUnknown: true,
    notes: "Volatility alone is not directional momentum.",
  },
  timeframeRoles: [
    {
      role: "PRIMARY_DIRECTION",
      mode: "OPTIONAL",
      typicalTimeframes: ["H4"],
      notes: "",
    },
    {
      role: "OPPORTUNITY_FORMATION",
      mode: "REQUIRED",
      typicalTimeframes: ["M15", "M5", "H1"],
      notes: "Expansion observation TF.",
    },
  ],
  confirmations: [
    {
      confirmationId: "me.atr_displace",
      description: "ATR-normalized displacement with directional structure — not volatility alone.",
      requireClosedCandle: true,
      notes: "",
    },
  ],
  invalidations: [
    {
      invalidationId: "me.exhaustion",
      description: "Displacement fails / reverses with closed evidence against expansion direction.",
      notes: "",
    },
  ],
  knownLimitations: [
    "MOMENTUM family is PLANNED; use displacement+volatility+regime until then.",
  ],
};

export const MIF_STRATEGY_PATTERN_COMPLETION: MifStrategyDefinition = {
  ...baseSafety(),
  strategyId: "PATTERN_COMPLETION",
  name: "Pattern Completion",
  description: "Setup approaching or completing a recognized chart or harmonic pattern.",
  purpose: "Identify a setup approaching or completing a recognized chart or harmonic pattern.",
  categories: ["PATTERN_BASED"],
  requiredEvidence: [
    evidenceReq({
      evidenceId: "pc.quality",
      family: "DATA_QUALITY",
      mode: "REQUIRED",
      missingAffects: "INELIGIBLE",
    }),
  ],
  optionalEvidence: [
    evidenceReq({
      evidenceId: "pc.geometric",
      family: "GEOMETRIC_PATTERN",
      mode: "OPTIONAL",
      missingAffects: "IGNORE",
      notes: "At least one of geometric or harmonic must be PRESENT (eligibility rule).",
    }),
    evidenceReq({
      evidenceId: "pc.harmonic",
      family: "HARMONIC_PATTERN",
      mode: "OPTIONAL",
      missingAffects: "IGNORE",
      notes: "At least one of geometric or harmonic must be PRESENT (eligibility rule).",
    }),
    evidenceReq({
      evidenceId: "pc.fib",
      family: "FIBONACCI",
      mode: "OPTIONAL",
      missingAffects: "WARNING",
    }),
  ],
  regimeCompatibility: {
    directions: ["UP", "DOWN", "NEUTRAL", "UNKNOWN"],
    structures: ["TRENDING", "RANGING", "TRANSITION", "BREAKOUT", "UNSTABLE"],
    volatilities: ["LOW", "NORMAL", "HIGH", "EXTREME"],
    rejectUnknown: false,
    notes: "Reuses Phase 5C pattern/harmonic outputs — does not duplicate detection.",
  },
  timeframeRoles: [
    {
      role: "SETUP_DEVELOPMENT",
      mode: "REQUIRED",
      typicalTimeframes: ["H1", "M30", "M15"],
      notes: "Pattern development TF.",
    },
    {
      role: "LOWER_TIMEFRAME_CONFIRMATION",
      mode: "OPTIONAL",
      typicalTimeframes: ["M5", "M1"],
      notes: "Optional confirmation; M1 optional.",
    },
  ],
  confirmations: [
    {
      confirmationId: "pc.lifecycle_confirm",
      description: "Pattern lifecycle reaches CONFIRMED under source engine rules (closed candles).",
      requireClosedCandle: true,
      notes: "FORMING ≠ CONFIRMED.",
    },
  ],
  invalidations: [
    {
      invalidationId: "pc.pattern_invalidated",
      description: "Source pattern lifecycle FAILED or INVALIDATED.",
      notes: "",
    },
  ],
  knownLimitations: [
    "Does not re-detect patterns — references Phase 5C assessments only.",
    "Eligibility requires at least one of geometric or harmonic evidence PRESENT.",
  ],
};

/** Immutable ordered catalog — source of truth for the registry. */
export const MIF_STRATEGY_CATALOG: readonly MifStrategyDefinition[] = Object.freeze([
  MIF_STRATEGY_TREND_CONTINUATION,
  MIF_STRATEGY_PULLBACK,
  MIF_STRATEGY_REVERSAL,
  MIF_STRATEGY_BREAKOUT,
  MIF_STRATEGY_BREAKOUT_RETEST,
  MIF_STRATEGY_RANGE,
  MIF_STRATEGY_LIQUIDITY_SWEEP,
  MIF_STRATEGY_SUPPLY_DEMAND,
  MIF_STRATEGY_MOMENTUM_EXPANSION,
  MIF_STRATEGY_PATTERN_COMPLETION,
]);

export const MIF_STRATEGY_IDS: readonly MifStrategyId[] = Object.freeze(
  MIF_STRATEGY_CATALOG.map((s) => s.strategyId),
);

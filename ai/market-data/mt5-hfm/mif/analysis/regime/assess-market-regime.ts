/**
 * Phase 5C Step 2 — assessMifMarketRegime public entry.
 * Dimensional regime classification. No LLM. No execution.
 */
import { DEFAULT_STRUCTURE_PARAMS, mergeStructureParams } from "../../../../../forex-structure/params.js";
import { detectSwings } from "../../../../../forex-structure/swings.js";
import type { StructureRuleParams } from "../../../../../forex-structure/types.js";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import type { MifStep1DataIntegrityAssessment } from "../../quality/types.js";
import type { MifUnifiedQualityAssessment } from "../../quality/unified/types.js";
import { mifCandlesToStructureCandles } from "../adapter/mif-to-structure-candle.js";
import {
  evaluateMifAnalyticalQualityGate,
  type MifQualityGateSource,
} from "../quality/assessment-quality-gate.js";
import { resolvePatternAtr } from "../patterns/atr.js";
import {
  applyHysteresis,
  classifyBreakout,
  classifyRange,
  classifyTrend,
  classifyVolatility,
  compositeLabel,
  resolveStructure,
} from "./classify.js";
import {
  MIF_REG_ADAPTER_BLOCKED,
  MIF_REG_ATR_UNAVAILABLE,
  MIF_REG_CONFLICTING_EVIDENCE,
  MIF_REG_INSUFFICIENT_HISTORY,
  MIF_REG_OK,
  MIF_REG_POLICY_INVALID,
  MIF_REG_POLICY_UNAVAILABLE,
  MIF_REG_QUALITY_BLOCKED,
  MIF_REG_QUALITY_MISSING,
  type MifMarketRegimeReasonCode,
} from "./codes.js";
import {
  MIF_MARKET_REGIME_ATR_METHOD_ID,
  MIF_MARKET_REGIME_CONTRACT_ID,
  MIF_MARKET_REGIME_CONTRACT_VERSION,
  MIF_MARKET_REGIME_ENGINE_ID,
  MIF_MARKET_REGIME_ENGINE_VERSION,
  MIF_MARKET_REGIME_POLICY_ID,
  MIF_MARKET_REGIME_POLICY_VERSION,
} from "./contracts.js";
import { buildMarketRegimeDiagnostics } from "./diagnostics.js";
import {
  MIF_POLICY_HFM_MARKET_REGIME,
  validateMifMarketRegimePolicy,
  type MifMarketRegimePolicyRegistry,
} from "./policies.js";
import { computeMarketRegimeInputIdentity } from "./stable-identity.js";
import type {
  MifMarketRegimeAssessment,
  MifMarketRegimeAssessmentStatus,
  MifMarketRegimeFinding,
  MifMarketRegimePolicy,
  MifRegimeDirection,
  MifRegimeStructure,
} from "./types.js";

export interface AssessMifMarketRegimeInput {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  instrument?: MifCanonicalInstrument | null;
  quality:
    | { kind: "step1-data-integrity"; assessment: MifStep1DataIntegrityAssessment }
    | { kind: "step3-unified-quality"; assessment: MifUnifiedQualityAssessment }
    | null;
  policy?: MifMarketRegimePolicy | null;
  policyId?: string;
  policyVersion?: string;
  policyRegistry?: MifMarketRegimePolicyRegistry | null;
  structureParams?: Partial<StructureRuleParams>;
  /** Prior structure for hysteresis (same input reassessed without prior → deterministic). */
  previousStructure?: MifRegimeStructure | null;
  previousDirection?: MifRegimeDirection | null;
  /** Consecutive closed assessments already suggesting the candidate structure. */
  sameCandidateStreak?: number;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

function resolvePolicy(input: AssessMifMarketRegimeInput): {
  policy: MifMarketRegimePolicy | null;
  findings: MifMarketRegimeFinding[];
} {
  const findings: MifMarketRegimeFinding[] = [];
  if (input.policy) {
    const v = validateMifMarketRegimePolicy(input.policy);
    if (!v.ok) {
      findings.push({
        code: MIF_REG_POLICY_INVALID,
        severity: "blocking",
        message: `invalid policy: ${v.errors.join("; ")}`,
      });
      return { policy: null, findings };
    }
    return { policy: input.policy, findings };
  }
  const policyId = input.policyId ?? MIF_MARKET_REGIME_POLICY_ID;
  const policyVersion = input.policyVersion ?? MIF_MARKET_REGIME_POLICY_VERSION;
  if (input.policyRegistry) {
    const found = input.policyRegistry.get(policyId, policyVersion);
    if (!found) {
      findings.push({
        code: MIF_REG_POLICY_UNAVAILABLE,
        severity: "blocking",
        message: `policy ${policyId}@${policyVersion} unavailable`,
      });
      return { policy: null, findings };
    }
    return { policy: found, findings };
  }
  if (policyId === MIF_MARKET_REGIME_POLICY_ID && policyVersion === MIF_MARKET_REGIME_POLICY_VERSION) {
    return { policy: MIF_POLICY_HFM_MARKET_REGIME, findings };
  }
  findings.push({
    code: MIF_REG_POLICY_UNAVAILABLE,
    severity: "blocking",
    message: `policy ${policyId}@${policyVersion} unavailable (no registry)`,
  });
  return { policy: null, findings };
}

function emptyTrend() {
  return {
    higherHighs: 0,
    higherLows: 0,
    lowerHighs: 0,
    lowerLows: 0,
    displacement: null,
    displacementAtr: null,
    persistenceBars: 0,
    directionHint: "UNKNOWN" as const,
  };
}

function emptyRange() {
  return {
    high: null,
    low: null,
    width: null,
    widthAtr: null,
    containmentRatio: null,
    displacementAtr: null,
  };
}

function emptyBreakout() {
  return {
    state: "NONE" as const,
    direction: "NEUTRAL" as const,
    boundary: null,
    breakCandleOpenTimeSec: null,
    displacementAtr: null,
    followThroughBars: 0,
  };
}

function emptyVol() {
  return {
    atr: null,
    atrBaseline: null,
    atrRatio: null,
    classification: "UNKNOWN" as const,
  };
}

function buildAssessment(input: {
  providerSymbol: string;
  timeframe: string;
  instrument: MifCanonicalInstrument | null;
  policy: MifMarketRegimePolicy | null;
  status: MifMarketRegimeAssessmentStatus;
  findings: MifMarketRegimeFinding[];
  qualityRef: MifMarketRegimeAssessment["qualityRef"];
  direction: MifMarketRegimeAssessment["direction"];
  structure: MifMarketRegimeAssessment["structure"];
  volatility: MifMarketRegimeAssessment["volatility"];
  compositeLabel: MifMarketRegimeAssessment["compositeLabel"];
  trendEvidence: MifMarketRegimeAssessment["trendEvidence"];
  rangeEvidence: MifMarketRegimeAssessment["rangeEvidence"];
  breakoutEvidence: MifMarketRegimeAssessment["breakoutEvidence"];
  volatilityEvidence: MifMarketRegimeAssessment["volatilityEvidence"];
  transition: MifMarketRegimeAssessment["transition"];
  diagnostics: MifMarketRegimeAssessment["diagnostics"];
  candles: readonly MifCanonicalCandle[];
  assessmentTimestamp: string;
  assessmentId?: string;
}): MifMarketRegimeAssessment {
  const policyForIdentity = input.policy ?? MIF_POLICY_HFM_MARKET_REGIME;
  const inputIdentity = computeMarketRegimeInputIdentity({
    contractId: MIF_MARKET_REGIME_CONTRACT_ID,
    contractVersion: MIF_MARKET_REGIME_CONTRACT_VERSION,
    engineId: MIF_MARKET_REGIME_ENGINE_ID,
    engineVersion: MIF_MARKET_REGIME_ENGINE_VERSION,
    policy: policyForIdentity,
    providerSymbol: input.providerSymbol,
    timeframe: input.timeframe,
    candles: input.candles,
    qualityInputIdentity: input.qualityRef.inputIdentity,
    direction: input.direction,
    structure: input.structure,
    volatility: input.volatility,
    previousStructure: input.transition.previousStructure,
  });
  const warningCodes = input.findings.filter((f) => f.severity === "warning").map((f) => f.code);
  const blockingCodes = input.findings.filter((f) => f.severity === "blocking").map((f) => f.code);
  return {
    contractId: MIF_MARKET_REGIME_CONTRACT_ID,
    contractVersion: MIF_MARKET_REGIME_CONTRACT_VERSION,
    scope: "step2-market-regime",
    assessmentId: input.assessmentId ?? `reg:${inputIdentity.slice(0, 16)}`,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    timeframe: String(input.timeframe || "").trim(),
    instrument: input.instrument,
    policyId: input.policy?.policyId ?? null,
    policyVersion: input.policy?.policyVersion ?? null,
    engineId: MIF_MARKET_REGIME_ENGINE_ID,
    engineVersion: MIF_MARKET_REGIME_ENGINE_VERSION,
    assessmentTimestamp: input.assessmentTimestamp,
    status: input.status,
    direction: input.direction,
    structure: input.structure,
    volatility: input.volatility,
    compositeLabel: input.compositeLabel,
    trendEvidence: input.trendEvidence,
    rangeEvidence: input.rangeEvidence,
    breakoutEvidence: input.breakoutEvidence,
    volatilityEvidence: input.volatilityEvidence,
    transition: input.transition,
    qualityRef: input.qualityRef,
    findings: input.findings,
    warningCodes,
    blockingCodes,
    diagnostics: input.diagnostics,
    diagnosticsSummary: input.diagnostics.overallStatusReason,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalRegimeInformationOnly: true,
  };
}

/**
 * Classify market regime dimensions from HFM_MT5 canonical candles.
 */
export function assessMifMarketRegime(input: AssessMifMarketRegimeInput): MifMarketRegimeAssessment {
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim();
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const instrument = input.instrument ?? null;
  const candles = input.candles ?? [];

  const { policy, findings: policyFindings } = resolvePolicy(input);
  const emptyTransition = {
    previousStructure: input.previousStructure ?? null,
    previousDirection: input.previousDirection ?? null,
    changed: false,
    hysteresisHeld: false,
    reason: "not assessed",
  };

  if (!policy) {
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy: null,
      status: "BLOCKED",
      findings: policyFindings,
      qualityRef: { sourceKind: null, status: "MISSING", inputIdentity: null, assessmentId: null },
      direction: "UNKNOWN",
      structure: "UNKNOWN",
      volatility: "UNKNOWN",
      compositeLabel: "INSUFFICIENT_DATA",
      trendEvidence: emptyTrend(),
      rangeEvidence: emptyRange(),
      breakoutEvidence: emptyBreakout(),
      volatilityEvidence: emptyVol(),
      transition: emptyTransition,
      diagnostics: buildMarketRegimeDiagnostics({
        reason: policyFindings[0]?.message ?? "policy unavailable",
        closedBarCount: 0,
        confirmedSwingCount: 0,
        atrMethodId: MIF_MARKET_REGIME_ATR_METHOD_ID,
        atrValue: null,
        atrPeriod: 14,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  const gate = evaluateMifAnalyticalQualityGate({
    quality: input.quality as MifQualityGateSource | null,
    allowedStatusesForConfirmedAnchors: policy.allowedQualityStatuses,
  });
  const qualityRef: MifMarketRegimeAssessment["qualityRef"] = {
    sourceKind: gate.sourceKind,
    status: gate.qualityStatus,
    inputIdentity: gate.qualityInputIdentity,
    assessmentId: gate.qualityAssessmentId,
  };
  const findings: MifMarketRegimeFinding[] = [...policyFindings];

  if (!gate.present) {
    findings.push({
      code: MIF_REG_QUALITY_MISSING,
      severity: "blocking",
      message: gate.message,
    });
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status: "INSUFFICIENT_DATA",
      findings,
      qualityRef,
      direction: "UNKNOWN",
      structure: "UNKNOWN",
      volatility: "UNKNOWN",
      compositeLabel: "INSUFFICIENT_DATA",
      trendEvidence: emptyTrend(),
      rangeEvidence: emptyRange(),
      breakoutEvidence: emptyBreakout(),
      volatilityEvidence: emptyVol(),
      transition: { ...emptyTransition, reason: gate.message },
      diagnostics: buildMarketRegimeDiagnostics({
        reason: gate.message,
        closedBarCount: 0,
        confirmedSwingCount: 0,
        atrMethodId: policy.atrMethodId,
        atrValue: null,
        atrPeriod: policy.atrPeriod,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  if (gate.qualityStatus === "BLOCKED") {
    findings.push({
      code: MIF_REG_QUALITY_BLOCKED,
      severity: "blocking",
      message: gate.message,
    });
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status: "BLOCKED",
      findings,
      qualityRef,
      direction: "UNKNOWN",
      structure: "UNKNOWN",
      volatility: "UNKNOWN",
      compositeLabel: "INSUFFICIENT_DATA",
      trendEvidence: emptyTrend(),
      rangeEvidence: emptyRange(),
      breakoutEvidence: emptyBreakout(),
      volatilityEvidence: emptyVol(),
      transition: { ...emptyTransition, reason: gate.message },
      diagnostics: buildMarketRegimeDiagnostics({
        reason: gate.message,
        closedBarCount: 0,
        confirmedSwingCount: 0,
        atrMethodId: policy.atrMethodId,
        atrValue: null,
        atrPeriod: policy.atrPeriod,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  if (!policy.allowedQualityStatuses.includes(gate.qualityStatus)) {
    findings.push({
      code: MIF_REG_QUALITY_BLOCKED,
      severity: "blocking",
      message: "quality status not allowed for regime classification under policy",
    });
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status: "INSUFFICIENT_DATA",
      findings,
      qualityRef,
      direction: "UNKNOWN",
      structure: "UNKNOWN",
      volatility: "UNKNOWN",
      compositeLabel: "INSUFFICIENT_DATA",
      trendEvidence: emptyTrend(),
      rangeEvidence: emptyRange(),
      breakoutEvidence: emptyBreakout(),
      volatilityEvidence: emptyVol(),
      transition: { ...emptyTransition, reason: findings[findings.length - 1]!.message },
      diagnostics: buildMarketRegimeDiagnostics({
        reason: findings[findings.length - 1]!.message,
        closedBarCount: 0,
        confirmedSwingCount: 0,
        atrMethodId: policy.atrMethodId,
        atrValue: null,
        atrPeriod: policy.atrPeriod,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  const adapted = mifCandlesToStructureCandles({
    candles,
    providerSymbol,
    timeframe,
    includeForming: false,
  });
  if (adapted.blocking || !adapted.ok) {
    findings.push({
      code: MIF_REG_ADAPTER_BLOCKED,
      severity: "blocking",
      message: adapted.issues[0]?.message ?? "structure adapter blocked",
    });
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status: "BLOCKED",
      findings,
      qualityRef,
      direction: "UNKNOWN",
      structure: "UNKNOWN",
      volatility: "UNKNOWN",
      compositeLabel: "INSUFFICIENT_DATA",
      trendEvidence: emptyTrend(),
      rangeEvidence: emptyRange(),
      breakoutEvidence: emptyBreakout(),
      volatilityEvidence: emptyVol(),
      transition: { ...emptyTransition, reason: "adapter blocked" },
      diagnostics: buildMarketRegimeDiagnostics({
        reason: "adapter blocked",
        closedBarCount: 0,
        confirmedSwingCount: 0,
        atrMethodId: policy.atrMethodId,
        atrValue: null,
        atrPeriod: policy.atrPeriod,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  const atrRes = resolvePatternAtr({
    candles: adapted.structureCandles,
    period: policy.atrPeriod,
    methodId: policy.atrMethodId,
  });
  if (atrRes.atr == null) {
    findings.push({
      code: MIF_REG_ATR_UNAVAILABLE,
      severity: "blocking",
      message: atrRes.error ?? "ATR unavailable",
    });
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status: "INSUFFICIENT_DATA",
      findings,
      qualityRef,
      direction: "UNKNOWN",
      structure: "UNKNOWN",
      volatility: "UNKNOWN",
      compositeLabel: "INSUFFICIENT_DATA",
      trendEvidence: emptyTrend(),
      rangeEvidence: emptyRange(),
      breakoutEvidence: emptyBreakout(),
      volatilityEvidence: emptyVol(),
      transition: { ...emptyTransition, reason: atrRes.error ?? "ATR unavailable" },
      diagnostics: buildMarketRegimeDiagnostics({
        reason: atrRes.error ?? "ATR unavailable",
        closedBarCount: adapted.closedCount,
        confirmedSwingCount: 0,
        atrMethodId: policy.atrMethodId,
        atrValue: null,
        atrPeriod: policy.atrPeriod,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  if (adapted.closedCount < Math.max(policy.lookbackBars, policy.atrPeriod + 2, 10)) {
    findings.push({
      code: MIF_REG_INSUFFICIENT_HISTORY,
      severity: "blocking",
      message: "insufficient closed candle history for regime classification",
      evidence: { closedCount: adapted.closedCount },
    });
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status: "INSUFFICIENT_DATA",
      findings,
      qualityRef,
      direction: "UNKNOWN",
      structure: "UNKNOWN",
      volatility: "UNKNOWN",
      compositeLabel: "INSUFFICIENT_DATA",
      trendEvidence: emptyTrend(),
      rangeEvidence: emptyRange(),
      breakoutEvidence: emptyBreakout(),
      volatilityEvidence: emptyVol(),
      transition: { ...emptyTransition, reason: "insufficient history" },
      diagnostics: buildMarketRegimeDiagnostics({
        reason: "insufficient history",
        closedBarCount: adapted.closedCount,
        confirmedSwingCount: 0,
        atrMethodId: policy.atrMethodId,
        atrValue: atrRes.atr,
        atrPeriod: policy.atrPeriod,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  const params = mergeStructureParams(input.structureParams ?? DEFAULT_STRUCTURE_PARAMS);
  const swings = detectSwings(
    adapted.structureCandles,
    adapted.closedCount,
    params,
    false,
  );
  const confirmedSwingCount = swings.filter((s) => s.status === "CONFIRMED").length;

  if (confirmedSwingCount < policy.minConfirmedSwings) {
    findings.push({
      code: MIF_REG_INSUFFICIENT_HISTORY,
      severity: "blocking",
      message: "insufficient confirmed swings for regime structure",
      evidence: { confirmedSwingCount },
    });
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status: "INSUFFICIENT_DATA",
      findings,
      qualityRef,
      direction: "UNKNOWN",
      structure: "UNKNOWN",
      volatility: "UNKNOWN",
      compositeLabel: "INSUFFICIENT_DATA",
      trendEvidence: emptyTrend(),
      rangeEvidence: emptyRange(),
      breakoutEvidence: emptyBreakout(),
      volatilityEvidence: classifyVolatility({
        candles: adapted.structureCandles,
        atr: atrRes.atr,
        atrPeriod: policy.atrPeriod,
        policy,
      }),
      transition: { ...emptyTransition, reason: "insufficient swings" },
      diagnostics: buildMarketRegimeDiagnostics({
        reason: "insufficient swings",
        closedBarCount: adapted.closedCount,
        confirmedSwingCount,
        atrMethodId: policy.atrMethodId,
        atrValue: atrRes.atr,
        atrPeriod: policy.atrPeriod,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  const trendEvidence = classifyTrend({
    swings,
    candles: adapted.structureCandles,
    atr: atrRes.atr,
    policy,
  });
  const rangeEvidence = classifyRange({
    candles: adapted.structureCandles,
    atr: atrRes.atr,
    policy,
    trend: trendEvidence,
  });
  const breakoutEvidence = classifyBreakout({
    candles: adapted.structureCandles,
    atr: atrRes.atr,
    policy,
    range: rangeEvidence,
  });
  const volatilityEvidence = classifyVolatility({
    candles: adapted.structureCandles,
    atr: atrRes.atr,
    atrPeriod: policy.atrPeriod,
    policy,
  });

  const resolved = resolveStructure({
    trend: trendEvidence,
    range: rangeEvidence,
    breakout: breakoutEvidence,
    policy,
    previousStructure: input.previousStructure,
  });

  const hyst = applyHysteresis({
    candidate: resolved.structure,
    previous: input.previousStructure,
    persistBars: policy.structurePersistBars,
    sameCandidateStreak: input.sameCandidateStreak ?? 0,
  });

  const structure = hyst.structure;
  const direction =
    structure === "TRENDING"
      ? resolved.direction
      : structure === "BREAKOUT"
        ? breakoutEvidence.direction
        : structure === "RANGING"
          ? "NEUTRAL"
          : resolved.direction;
  const volatility = volatilityEvidence.classification;

  if (resolved.conflicting) {
    findings.push({
      code: MIF_REG_CONFLICTING_EVIDENCE,
      severity: "warning",
      message: "conflicting trend/range evidence → UNSTABLE",
    });
  }

  findings.push({
    code: MIF_REG_OK,
    severity: "info",
    message: `regime ${structure}/${direction}/${volatility} — analytical information only`,
  });

  let status: MifMarketRegimeAssessmentStatus = "VALID";
  if (gate.qualityStatus === "WARNING") status = "WARNING";
  if (gate.qualityStatus === "DEGRADED") status = "DEGRADED";
  if (structure === "UNSTABLE" || structure === "TRANSITION") status = "WARNING";
  if (structure === "UNKNOWN") status = "INSUFFICIENT_DATA";

  const label = compositeLabel({ direction, structure, volatility, status });
  const previousStructure = input.previousStructure ?? null;
  const changed = previousStructure != null && previousStructure !== structure;

  return buildAssessment({
    providerSymbol,
    timeframe,
    instrument,
    policy,
    status,
    findings,
    qualityRef,
    direction,
    structure,
    volatility,
    compositeLabel: label,
    trendEvidence,
    rangeEvidence,
    breakoutEvidence,
    volatilityEvidence,
    transition: {
      previousStructure,
      previousDirection: input.previousDirection ?? null,
      changed,
      hysteresisHeld: hyst.hysteresisHeld,
      reason: hyst.hysteresisHeld
        ? `hysteresis held previous ${previousStructure} (candidate ${resolved.structure})`
        : changed
          ? `transition ${previousStructure} → ${structure}`
          : `stable ${structure}`,
    },
    diagnostics: buildMarketRegimeDiagnostics({
      reason: `structure=${structure} direction=${direction} vol=${volatility}`,
      closedBarCount: adapted.closedCount,
      confirmedSwingCount,
      atrMethodId: policy.atrMethodId,
      atrValue: atrRes.atr,
      atrPeriod: policy.atrPeriod,
    }),
    candles,
    assessmentTimestamp,
    assessmentId: input.assessmentId,
  });
}

export type { MifMarketRegimeReasonCode };

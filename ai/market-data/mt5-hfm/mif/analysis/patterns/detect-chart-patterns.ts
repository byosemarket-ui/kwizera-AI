/**
 * Phase 5C Step 1B — assessMifChartPatterns public entry.
 * Deterministic geometric patterns only. No LLM. No execution.
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
import { resolvePatternAtr } from "./atr.js";
import {
  MIF_PAT_ADAPTER_BLOCKED,
  MIF_PAT_ATR_UNAVAILABLE,
  MIF_PAT_INSUFFICIENT_SWINGS,
  MIF_PAT_NO_CANDIDATES,
  MIF_PAT_OK,
  MIF_PAT_POLICY_INVALID,
  MIF_PAT_POLICY_UNAVAILABLE,
  MIF_PAT_QUALITY_BLOCKED,
  MIF_PAT_QUALITY_DISALLOWS_CONFIRMED,
  MIF_PAT_QUALITY_MISSING,
  type MifChartPatternReasonCode,
} from "./codes.js";
import {
  MIF_CHART_PATTERNS_ATR_METHOD_ID,
  MIF_CHART_PATTERNS_CONTRACT_ID,
  MIF_CHART_PATTERNS_CONTRACT_VERSION,
  MIF_CHART_PATTERNS_ENGINE_ID,
  MIF_CHART_PATTERNS_ENGINE_VERSION,
  MIF_CHART_PATTERNS_POLICY_ID,
  MIF_CHART_PATTERNS_POLICY_VERSION,
} from "./contracts.js";
import { buildPatternDiagnostics } from "./diagnostics.js";
import { confidenceComposite, evaluateBreakoutAndLifecycle } from "./lifecycle.js";
import { matchDoubleBottoms, matchDoubleTops } from "./matchers/double-top-bottom.js";
import { matchHeadAndShoulders, matchInverseHeadAndShoulders } from "./matchers/head-and-shoulders.js";
import { matchTriangles } from "./matchers/triangles.js";
import type { RawPatternCandidate } from "./matchers/types.js";
import {
  MIF_POLICY_HFM_CHART_PATTERNS,
  validateMifChartPatternPolicy,
  type MifChartPatternPolicyRegistry,
} from "./policies.js";
import {
  compareRawCandidates,
  computeChartPatternsInputIdentity,
  computeDetectionIdentity,
} from "./stable-identity.js";
import type {
  MifChartPatternAssessment,
  MifChartPatternAssessmentStatus,
  MifChartPatternDetection,
  MifChartPatternFinding,
  MifChartPatternPolicy,
} from "./types.js";

export interface AssessMifChartPatternsInput {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  instrument?: MifCanonicalInstrument | null;
  quality:
    | { kind: "step1-data-integrity"; assessment: MifStep1DataIntegrityAssessment }
    | { kind: "step3-unified-quality"; assessment: MifUnifiedQualityAssessment }
    | null;
  policy?: MifChartPatternPolicy | null;
  policyId?: string;
  policyVersion?: string;
  policyRegistry?: MifChartPatternPolicyRegistry | null;
  structureParams?: Partial<StructureRuleParams>;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

function resolvePolicy(input: AssessMifChartPatternsInput): {
  policy: MifChartPatternPolicy | null;
  findings: MifChartPatternFinding[];
} {
  const findings: MifChartPatternFinding[] = [];
  if (input.policy) {
    const v = validateMifChartPatternPolicy(input.policy);
    if (!v.ok) {
      findings.push({
        code: MIF_PAT_POLICY_INVALID,
        severity: "blocking",
        message: `invalid policy: ${v.errors.join("; ")}`,
      });
      return { policy: null, findings };
    }
    return { policy: input.policy, findings };
  }
  const policyId = input.policyId ?? MIF_CHART_PATTERNS_POLICY_ID;
  const policyVersion = input.policyVersion ?? MIF_CHART_PATTERNS_POLICY_VERSION;
  if (input.policyRegistry) {
    const found = input.policyRegistry.get(policyId, policyVersion);
    if (!found) {
      findings.push({
        code: MIF_PAT_POLICY_UNAVAILABLE,
        severity: "blocking",
        message: `policy ${policyId}@${policyVersion} unavailable`,
      });
      return { policy: null, findings };
    }
    return { policy: found, findings };
  }
  if (policyId === MIF_CHART_PATTERNS_POLICY_ID && policyVersion === MIF_CHART_PATTERNS_POLICY_VERSION) {
    return { policy: MIF_POLICY_HFM_CHART_PATTERNS, findings };
  }
  findings.push({
    code: MIF_PAT_POLICY_UNAVAILABLE,
    severity: "blocking",
    message: `policy ${policyId}@${policyVersion} unavailable (no registry)`,
  });
  return { policy: null, findings };
}

function buildAssessment(input: {
  providerSymbol: string;
  timeframe: string;
  instrument: MifCanonicalInstrument | null;
  policy: MifChartPatternPolicy | null;
  status: MifChartPatternAssessmentStatus;
  findings: MifChartPatternFinding[];
  qualityRef: MifChartPatternAssessment["qualityRef"];
  detections: MifChartPatternDetection[];
  diagnostics: MifChartPatternAssessment["diagnostics"];
  candles: readonly MifCanonicalCandle[];
  assessmentTimestamp: string;
  assessmentId?: string;
}): MifChartPatternAssessment {
  const policyForIdentity = input.policy ?? MIF_POLICY_HFM_CHART_PATTERNS;
  const inputIdentity = computeChartPatternsInputIdentity({
    contractId: MIF_CHART_PATTERNS_CONTRACT_ID,
    contractVersion: MIF_CHART_PATTERNS_CONTRACT_VERSION,
    engineId: MIF_CHART_PATTERNS_ENGINE_ID,
    engineVersion: MIF_CHART_PATTERNS_ENGINE_VERSION,
    policy: policyForIdentity,
    providerSymbol: input.providerSymbol,
    timeframe: input.timeframe,
    candles: input.candles,
    qualityInputIdentity: input.qualityRef.inputIdentity,
    detections: input.detections,
  });
  const warningCodes = input.findings.filter((f) => f.severity === "warning").map((f) => f.code);
  const blockingCodes = input.findings.filter((f) => f.severity === "blocking").map((f) => f.code);
  return {
    contractId: MIF_CHART_PATTERNS_CONTRACT_ID,
    contractVersion: MIF_CHART_PATTERNS_CONTRACT_VERSION,
    scope: "step1b-chart-patterns",
    assessmentId: input.assessmentId ?? `pat:${inputIdentity.slice(0, 16)}`,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    timeframe: String(input.timeframe || "").trim(),
    instrument: input.instrument,
    policyId: input.policy?.policyId ?? null,
    policyVersion: input.policy?.policyVersion ?? null,
    engineId: MIF_CHART_PATTERNS_ENGINE_ID,
    engineVersion: MIF_CHART_PATTERNS_ENGINE_VERSION,
    assessmentTimestamp: input.assessmentTimestamp,
    status: input.status,
    detections: input.detections,
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
    analyticalPatternInformationOnly: true,
  };
}

function finalizeCandidate(
  raw: RawPatternCandidate,
  policy: MifChartPatternPolicy,
  atr: number,
  candles: Parameters<typeof evaluateBreakoutAndLifecycle>[0]["candles"],
  allowConfirmed: boolean,
  qualityGateScore: number,
): MifChartPatternDetection {
  const life = evaluateBreakoutAndLifecycle({
    geometryValid: raw.geometryValid,
    structureInvalidated: raw.structureInvalidated,
    policy,
    atr,
    midPrice: raw.midPrice,
    breakBoundary: raw.breakBoundary,
    breakoutDirection: raw.breakoutDirection,
    afterPivotTimeSec: raw.afterPivotTimeSec,
    candles,
    allowConfirmed,
  });
  const breakoutClarity = life.confirmation.met ? 1 : life.lifecycle === "FORMING" ? 0.35 : 0;
  const confidenceComponents = confidenceComposite({
    geometryFit: raw.geometryFit,
    depthOrProminence: raw.depthOrProminence,
    symmetryOrTouches: raw.symmetryOrTouches,
    qualityGate: qualityGateScore,
    breakoutClarity,
  });
  const detectionIdentity = computeDetectionIdentity({
    patternType: raw.patternType,
    pivots: raw.pivots,
    lifecycle: life.lifecycle,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    engineVersion: MIF_CHART_PATTERNS_ENGINE_VERSION,
    confirmationCandleOpenTimeSec: life.confirmation.candleOpenTimeSec,
  });
  return {
    patternType: raw.patternType,
    lifecycle: life.lifecycle,
    pivots: raw.pivots,
    neckline: raw.neckline,
    upperBoundary: raw.upperBoundary,
    lowerBoundary: raw.lowerBoundary,
    measurements: raw.measurements,
    confidenceComponents,
    confirmation: life.confirmation,
    retest: life.retest,
    invalidationCriteria:
      "Required pivot geometry no longer holds (prominence/equality/boundary assumptions violated).",
    failureCriteria:
      `After CLOSED breakout, a CLOSED close back through the boundary within ${policy.failureWindowBars} bars.`,
    detectionIdentity,
  };
}

/**
 * Detect the seven approved geometric chart patterns on HFM_MT5 canonical candles.
 */
export function assessMifChartPatterns(input: AssessMifChartPatternsInput): MifChartPatternAssessment {
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim();
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const instrument = input.instrument ?? null;
  const candles = input.candles ?? [];

  const { policy, findings: policyFindings } = resolvePolicy(input);
  if (!policy) {
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy: null,
      status: "BLOCKED",
      findings: policyFindings,
      qualityRef: { sourceKind: null, status: "MISSING", inputIdentity: null, assessmentId: null },
      detections: [],
      diagnostics: buildPatternDiagnostics({
        reason: policyFindings[0]?.message ?? "policy unavailable",
        confirmedSwingCount: 0,
        provisionalSwingCount: 0,
        detections: [],
        atrMethodId: MIF_CHART_PATTERNS_ATR_METHOD_ID,
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
    allowedStatusesForConfirmedAnchors: policy.allowedQualityStatusesForConfirmed,
  });
  const qualityRef: MifChartPatternAssessment["qualityRef"] = {
    sourceKind: gate.sourceKind,
    status: gate.qualityStatus,
    inputIdentity: gate.qualityInputIdentity,
    assessmentId: gate.qualityAssessmentId,
  };
  const findings: MifChartPatternFinding[] = [...policyFindings];

  const allowConfirmed = gate.allowsConfirmedAnchors;
  const allowForming = policy.allowedQualityStatusesForForming.includes(gate.qualityStatus);

  if (!gate.present) {
    findings.push({
      code: MIF_PAT_QUALITY_MISSING,
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
      detections: [],
      diagnostics: buildPatternDiagnostics({
        reason: gate.message,
        confirmedSwingCount: 0,
        provisionalSwingCount: 0,
        detections: [],
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
      code: MIF_PAT_QUALITY_BLOCKED,
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
      detections: [],
      diagnostics: buildPatternDiagnostics({
        reason: gate.message,
        confirmedSwingCount: 0,
        provisionalSwingCount: 0,
        detections: [],
        atrMethodId: policy.atrMethodId,
        atrValue: null,
        atrPeriod: policy.atrPeriod,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  if (!allowConfirmed && !allowForming) {
    findings.push({
      code: MIF_PAT_QUALITY_DISALLOWS_CONFIRMED,
      severity: "blocking",
      message: "quality status does not allow FORMING or CONFIRMED under policy",
    });
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status: "INSUFFICIENT_DATA",
      findings,
      qualityRef,
      detections: [],
      diagnostics: buildPatternDiagnostics({
        reason: findings[findings.length - 1]!.message,
        confirmedSwingCount: 0,
        provisionalSwingCount: 0,
        detections: [],
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
      code: MIF_PAT_ADAPTER_BLOCKED,
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
      detections: [],
      diagnostics: buildPatternDiagnostics({
        reason: "adapter blocked",
        confirmedSwingCount: 0,
        provisionalSwingCount: 0,
        detections: [],
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
      code: MIF_PAT_ATR_UNAVAILABLE,
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
      detections: [],
      diagnostics: buildPatternDiagnostics({
        reason: atrRes.error ?? "ATR unavailable",
        confirmedSwingCount: 0,
        provisionalSwingCount: 0,
        detections: [],
        atrMethodId: policy.atrMethodId,
        atrValue: null,
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
  const provisionalSwingCount = swings.filter((s) => s.status === "PROVISIONAL").length;

  if (confirmedSwingCount < 3) {
    findings.push({
      code: MIF_PAT_INSUFFICIENT_SWINGS,
      severity: "blocking",
      message: "insufficient confirmed swings for geometric patterns",
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
      detections: [],
      diagnostics: buildPatternDiagnostics({
        reason: "insufficient confirmed swings",
        confirmedSwingCount,
        provisionalSwingCount,
        detections: [],
        atrMethodId: policy.atrMethodId,
        atrValue: atrRes.atr,
        atrPeriod: policy.atrPeriod,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  const qualityGateScore =
    gate.qualityStatus === "VALID" ? 1 : gate.qualityStatus === "WARNING" ? 0.6 : 0.3;

  const ctx = {
    swings,
    candles: adapted.structureCandles,
    policy,
    atr: atrRes.atr,
    allowConfirmed,
    qualityGateScore,
  };

  const raw: RawPatternCandidate[] = [
    ...matchDoubleTops(ctx),
    ...matchDoubleBottoms(ctx),
    ...matchHeadAndShoulders(ctx),
    ...matchInverseHeadAndShoulders(ctx),
    ...matchTriangles(ctx),
  ];
  raw.sort(compareRawCandidates);

  const detections = raw
    .slice(0, policy.maxDetections)
    .map((r) =>
      finalizeCandidate(
        r,
        policy,
        atrRes.atr!,
        adapted.structureCandles,
        allowConfirmed,
        qualityGateScore,
      )
    );

  // If quality forbids confirmed, force any CONFIRMED down is already handled in lifecycle.
  if (!allowConfirmed && allowForming) {
    findings.push({
      code: MIF_PAT_QUALITY_DISALLOWS_CONFIRMED,
      severity: "warning",
      message: "quality does not permit CONFIRMED — FORMING only",
    });
  }

  if (detections.length === 0) {
    findings.push({
      code: MIF_PAT_NO_CANDIDATES,
      severity: "info",
      message: "no geometric pattern candidates matched policy rules",
    });
  } else {
    findings.push({
      code: MIF_PAT_OK,
      severity: "info",
      message: `${detections.length} pattern detection(s) — analytical information only`,
    });
  }

  let status: MifChartPatternAssessmentStatus = "VALID";
  if (detections.some((d) => d.lifecycle === "FORMING") && !detections.some((d) => d.lifecycle === "CONFIRMED")) {
    status = "WARNING";
  }
  if (gate.qualityStatus === "WARNING") status = "WARNING";
  if (gate.qualityStatus === "DEGRADED") status = "DEGRADED";
  if (detections.length === 0) status = "INSUFFICIENT_DATA";

  return buildAssessment({
    providerSymbol,
    timeframe,
    instrument,
    policy,
    status,
    findings,
    qualityRef,
    detections,
    diagnostics: buildPatternDiagnostics({
      reason:
        detections.length === 0
          ? "no candidates"
          : `assessed ${detections.length} detection(s); confirmedAllowed=${allowConfirmed}`,
      confirmedSwingCount,
      provisionalSwingCount,
      detections,
      atrMethodId: policy.atrMethodId,
      atrValue: atrRes.atr,
      atrPeriod: policy.atrPeriod,
    }),
    candles,
    assessmentTimestamp,
    assessmentId: input.assessmentId,
  });
}

// silence unused type import if tree-shaken
export type { MifChartPatternReasonCode };

/**
 * Phase 5C Step 2 — assessMifHarmonicPatterns public entry.
 * Deterministic harmonic XABCD patterns only. No LLM. No execution.
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
  MIF_HAR_ADAPTER_BLOCKED,
  MIF_HAR_ATR_UNAVAILABLE,
  MIF_HAR_INSUFFICIENT_SWINGS,
  MIF_HAR_NO_CANDIDATES,
  MIF_HAR_OK,
  MIF_HAR_POLICY_INVALID,
  MIF_HAR_POLICY_UNAVAILABLE,
  MIF_HAR_QUALITY_BLOCKED,
  MIF_HAR_QUALITY_DISALLOWS_CONFIRMED,
  MIF_HAR_QUALITY_MISSING,
  type MifHarmonicReasonCode,
} from "./codes.js";
import {
  MIF_HARMONIC_ATR_METHOD_ID,
  MIF_HARMONIC_PATTERNS_CONTRACT_ID,
  MIF_HARMONIC_PATTERNS_CONTRACT_VERSION,
  MIF_HARMONIC_PATTERNS_ENGINE_ID,
  MIF_HARMONIC_PATTERNS_ENGINE_VERSION,
  MIF_HARMONIC_PATTERNS_POLICY_ID,
  MIF_HARMONIC_PATTERNS_POLICY_VERSION,
} from "./contracts.js";
import { buildHarmonicDiagnostics } from "./diagnostics.js";
import { evaluateHarmonicCandidate } from "./evaluate-candidate.js";
import {
  MIF_POLICY_HFM_HARMONIC_PATTERNS,
  validateMifHarmonicPolicy,
  type MifHarmonicPolicyRegistry,
} from "./policies.js";
import { selectXabcdWindows, swingToHarmonicPivot } from "./select-xabcd.js";
import {
  compareHarmonicDetections,
  computeHarmonicInputIdentity,
} from "./stable-identity.js";
import type {
  MifHarmonicAssessment,
  MifHarmonicAssessmentStatus,
  MifHarmonicDetection,
  MifHarmonicFinding,
  MifHarmonicPolicy,
} from "./types.js";

export interface AssessMifHarmonicPatternsInput {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  instrument?: MifCanonicalInstrument | null;
  quality:
    | { kind: "step1-data-integrity"; assessment: MifStep1DataIntegrityAssessment }
    | { kind: "step3-unified-quality"; assessment: MifUnifiedQualityAssessment }
    | null;
  policy?: MifHarmonicPolicy | null;
  policyId?: string;
  policyVersion?: string;
  policyRegistry?: MifHarmonicPolicyRegistry | null;
  structureParams?: Partial<StructureRuleParams>;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

function resolvePolicy(input: AssessMifHarmonicPatternsInput): {
  policy: MifHarmonicPolicy | null;
  findings: MifHarmonicFinding[];
} {
  const findings: MifHarmonicFinding[] = [];
  if (input.policy) {
    const v = validateMifHarmonicPolicy(input.policy);
    if (!v.ok) {
      findings.push({
        code: MIF_HAR_POLICY_INVALID,
        severity: "blocking",
        message: `invalid policy: ${v.errors.join("; ")}`,
      });
      return { policy: null, findings };
    }
    return { policy: input.policy, findings };
  }
  const policyId = input.policyId ?? MIF_HARMONIC_PATTERNS_POLICY_ID;
  const policyVersion = input.policyVersion ?? MIF_HARMONIC_PATTERNS_POLICY_VERSION;
  if (input.policyRegistry) {
    const found = input.policyRegistry.get(policyId, policyVersion);
    if (!found) {
      findings.push({
        code: MIF_HAR_POLICY_UNAVAILABLE,
        severity: "blocking",
        message: `policy ${policyId}@${policyVersion} unavailable`,
      });
      return { policy: null, findings };
    }
    return { policy: found, findings };
  }
  if (
    policyId === MIF_HARMONIC_PATTERNS_POLICY_ID
    && policyVersion === MIF_HARMONIC_PATTERNS_POLICY_VERSION
  ) {
    return { policy: MIF_POLICY_HFM_HARMONIC_PATTERNS, findings };
  }
  findings.push({
    code: MIF_HAR_POLICY_UNAVAILABLE,
    severity: "blocking",
    message: `policy ${policyId}@${policyVersion} unavailable (no registry)`,
  });
  return { policy: null, findings };
}

function buildAssessment(input: {
  providerSymbol: string;
  timeframe: string;
  instrument: MifCanonicalInstrument | null;
  policy: MifHarmonicPolicy | null;
  status: MifHarmonicAssessmentStatus;
  findings: MifHarmonicFinding[];
  qualityRef: MifHarmonicAssessment["qualityRef"];
  detections: MifHarmonicDetection[];
  diagnostics: MifHarmonicAssessment["diagnostics"];
  candles: readonly MifCanonicalCandle[];
  assessmentTimestamp: string;
  assessmentId?: string;
}): MifHarmonicAssessment {
  const policyForIdentity = input.policy ?? MIF_POLICY_HFM_HARMONIC_PATTERNS;
  const inputIdentity = computeHarmonicInputIdentity({
    contractId: MIF_HARMONIC_PATTERNS_CONTRACT_ID,
    contractVersion: MIF_HARMONIC_PATTERNS_CONTRACT_VERSION,
    engineId: MIF_HARMONIC_PATTERNS_ENGINE_ID,
    engineVersion: MIF_HARMONIC_PATTERNS_ENGINE_VERSION,
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
    contractId: MIF_HARMONIC_PATTERNS_CONTRACT_ID,
    contractVersion: MIF_HARMONIC_PATTERNS_CONTRACT_VERSION,
    scope: "step2-harmonic-patterns",
    assessmentId: input.assessmentId ?? `har:${inputIdentity.slice(0, 16)}`,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    timeframe: String(input.timeframe || "").trim(),
    instrument: input.instrument,
    policyId: input.policy?.policyId ?? null,
    policyVersion: input.policy?.policyVersion ?? null,
    engineId: MIF_HARMONIC_PATTERNS_ENGINE_ID,
    engineVersion: MIF_HARMONIC_PATTERNS_ENGINE_VERSION,
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
    analyticalHarmonicInformationOnly: true,
  };
}

/**
 * Detect Gartley / Bat / Butterfly / Crab / Shark on HFM_MT5 canonical candles.
 */
export function assessMifHarmonicPatterns(
  input: AssessMifHarmonicPatternsInput,
): MifHarmonicAssessment {
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
      diagnostics: buildHarmonicDiagnostics({
        reason: policyFindings[0]?.message ?? "policy unavailable",
        confirmedSwingCount: 0,
        provisionalSwingCount: 0,
        candidateCount: 0,
        detections: [],
        atrMethodId: MIF_HARMONIC_ATR_METHOD_ID,
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
  const qualityRef: MifHarmonicAssessment["qualityRef"] = {
    sourceKind: gate.sourceKind,
    status: gate.qualityStatus,
    inputIdentity: gate.qualityInputIdentity,
    assessmentId: gate.qualityAssessmentId,
  };
  const findings: MifHarmonicFinding[] = [...policyFindings];
  const allowConfirmed = gate.allowsConfirmedAnchors;
  const allowForming = policy.allowedQualityStatusesForForming.includes(gate.qualityStatus);

  if (!gate.present) {
    findings.push({
      code: MIF_HAR_QUALITY_MISSING,
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
      diagnostics: buildHarmonicDiagnostics({
        reason: gate.message,
        confirmedSwingCount: 0,
        provisionalSwingCount: 0,
        candidateCount: 0,
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
      code: MIF_HAR_QUALITY_BLOCKED,
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
      diagnostics: buildHarmonicDiagnostics({
        reason: gate.message,
        confirmedSwingCount: 0,
        provisionalSwingCount: 0,
        candidateCount: 0,
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
      code: MIF_HAR_QUALITY_DISALLOWS_CONFIRMED,
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
      diagnostics: buildHarmonicDiagnostics({
        reason: findings[findings.length - 1]!.message,
        confirmedSwingCount: 0,
        provisionalSwingCount: 0,
        candidateCount: 0,
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
      code: MIF_HAR_ADAPTER_BLOCKED,
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
      diagnostics: buildHarmonicDiagnostics({
        reason: "adapter blocked",
        confirmedSwingCount: 0,
        provisionalSwingCount: 0,
        candidateCount: 0,
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
      code: MIF_HAR_ATR_UNAVAILABLE,
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
      diagnostics: buildHarmonicDiagnostics({
        reason: atrRes.error ?? "ATR unavailable",
        confirmedSwingCount: 0,
        provisionalSwingCount: 0,
        candidateCount: 0,
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

  if (confirmedSwingCount < 5) {
    findings.push({
      code: MIF_HAR_INSUFFICIENT_SWINGS,
      severity: "blocking",
      message: "insufficient confirmed swings for XABCD harmonic patterns",
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
      diagnostics: buildHarmonicDiagnostics({
        reason: "insufficient confirmed swings",
        confirmedSwingCount,
        provisionalSwingCount,
        candidateCount: 0,
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

  const windows = selectXabcdWindows(swings, policy, {
    tickSize: instrument?.tickSize ?? null,
    includeProvisionalTip: allowForming && !allowConfirmed,
  });

  const detections: MifHarmonicDetection[] = [];
  for (const w of windows) {
    const pivots = [
      swingToHarmonicPivot("X", w.pivots[0]),
      swingToHarmonicPivot("A", w.pivots[1]),
      swingToHarmonicPivot("B", w.pivots[2]),
      swingToHarmonicPivot("C", w.pivots[3]),
      swingToHarmonicPivot("D", w.pivots[4]),
    ];
    const matched = evaluateHarmonicCandidate({
      pivots,
      orientation: w.orientation,
      policy,
      atr: atrRes.atr,
      candles: adapted.structureCandles,
      allowConfirmed,
    });
    detections.push(...matched);
  }

  detections.sort(compareHarmonicDetections);
  const capped = detections.slice(0, policy.maxDetections);

  if (!allowConfirmed && allowForming) {
    findings.push({
      code: MIF_HAR_QUALITY_DISALLOWS_CONFIRMED,
      severity: "warning",
      message: "quality does not permit CONFIRMED — FORMING only",
    });
  }

  if (capped.length === 0) {
    findings.push({
      code: MIF_HAR_NO_CANDIDATES,
      severity: "info",
      message: "no harmonic pattern candidates matched policy ratio rules",
    });
  } else {
    findings.push({
      code: MIF_HAR_OK,
      severity: "info",
      message: `${capped.length} harmonic detection(s) — analytical information only`,
    });
  }

  let status: MifHarmonicAssessmentStatus = "VALID";
  if (capped.some((d) => d.lifecycle === "FORMING") && !capped.some((d) => d.lifecycle === "CONFIRMED")) {
    status = "WARNING";
  }
  if (gate.qualityStatus === "WARNING") status = "WARNING";
  if (gate.qualityStatus === "DEGRADED") status = "DEGRADED";
  if (capped.length === 0) status = "INSUFFICIENT_DATA";

  return buildAssessment({
    providerSymbol,
    timeframe,
    instrument,
    policy,
    status,
    findings,
    qualityRef,
    detections: capped,
    diagnostics: buildHarmonicDiagnostics({
      reason:
        capped.length === 0
          ? "no candidates"
          : `assessed ${capped.length} detection(s); confirmedAllowed=${allowConfirmed}`,
      confirmedSwingCount,
      provisionalSwingCount,
      candidateCount: windows.length,
      detections: capped,
      atrMethodId: policy.atrMethodId,
      atrValue: atrRes.atr,
      atrPeriod: policy.atrPeriod,
    }),
    candles,
    assessmentTimestamp,
    assessmentId: input.assessmentId,
  });
}

export type { MifHarmonicReasonCode };

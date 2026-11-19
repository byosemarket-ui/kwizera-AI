/**
 * Phase 5C Step 1C — assessMifUnifiedChartAnalysis public entry.
 * Consumes existing pattern + Fibonacci assessments. Does not rewrite them.
 * Read-only. HFM_MT5 only. No AI/execution authorization.
 */
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifFibonacciAssessment } from "../fibonacci/types.js";
import type { MifChartPatternAssessment } from "../patterns/types.js";
import { calculateConfluence } from "./calculate-confluence.js";
import {
  MIF_UCA_CONTRACT_INCOMPATIBLE,
  MIF_UCA_OK,
  MIF_UCA_POLICY_INVALID,
  MIF_UCA_POLICY_UNAVAILABLE,
  MIF_UCA_PROVIDER_MISMATCH,
  MIF_UCA_QUALITY_BLOCKED,
  MIF_UCA_QUALITY_MISSING,
  MIF_UCA_SNAPSHOT_MISMATCH,
  MIF_UCA_SOURCE_INCOMPATIBLE,
  MIF_UCA_SOURCE_MISSING,
  MIF_UCA_SYMBOL_MISMATCH,
  MIF_UCA_TIMEFRAME_MISMATCH,
  MIF_UCA_NO_RELATIONSHIPS,
} from "./codes.js";
import {
  MIF_CHART_ANALYSIS_CONTRACT_ID,
  MIF_CHART_ANALYSIS_CONTRACT_VERSION,
  MIF_CHART_ANALYSIS_ENGINE_ID,
  MIF_CHART_ANALYSIS_ENGINE_VERSION,
  MIF_CHART_ANALYSIS_POLICY_ID,
  MIF_CHART_ANALYSIS_POLICY_VERSION,
} from "./contracts.js";
import { correlatePatternFibonacci } from "./correlate-pattern-fibonacci.js";
import { buildUnifiedChartAnalysisDiagnostics } from "./diagnostics.js";
import {
  MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS,
  validateMifUnifiedChartAnalysisPolicy,
  type MifUnifiedChartAnalysisPolicyRegistry,
} from "./policies.js";
import { aggregateUnifiedStatus, deriveUnifiedQualityStatus } from "./quality.js";
import {
  computeUnifiedChartAnalysisInputIdentity,
  relationshipIdsOf,
} from "./stable-identity.js";
import type {
  MifUnifiedChartAnalysisAssessment,
  MifUnifiedChartAnalysisFinding,
  MifUnifiedChartAnalysisPolicy,
  MifUnifiedChartAnalysisStatus,
  MifUnifiedSourceRefs,
} from "./types.js";

export interface AssessMifUnifiedChartAnalysisInput {
  /** Required STEP 1B assessment — referenced, not copied/mutated. */
  pattern: MifChartPatternAssessment | null;
  /** Required STEP 1A assessment — referenced, not copied/mutated. */
  fibonacci: MifFibonacciAssessment | null;
  /**
   * Optional explicit shared canonical snapshot identity.
   * When omitted, compatibility uses qualityRef.inputIdentity matching (per policy).
   */
  sharedCanonicalSnapshotIdentity?: string | null;
  policy?: MifUnifiedChartAnalysisPolicy | null;
  policyId?: string;
  policyVersion?: string;
  policyRegistry?: MifUnifiedChartAnalysisPolicyRegistry | null;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

function resolvePolicy(input: AssessMifUnifiedChartAnalysisInput): {
  policy: MifUnifiedChartAnalysisPolicy | null;
  findings: MifUnifiedChartAnalysisFinding[];
} {
  const findings: MifUnifiedChartAnalysisFinding[] = [];
  if (input.policy) {
    const v = validateMifUnifiedChartAnalysisPolicy(input.policy);
    if (!v.ok) {
      findings.push({
        code: MIF_UCA_POLICY_INVALID,
        severity: "blocking",
        message: `invalid policy: ${v.errors.join("; ")}`,
      });
      return { policy: null, findings };
    }
    return { policy: input.policy, findings };
  }
  const policyId = input.policyId ?? MIF_CHART_ANALYSIS_POLICY_ID;
  const policyVersion = input.policyVersion ?? MIF_CHART_ANALYSIS_POLICY_VERSION;
  if (input.policyRegistry) {
    const found = input.policyRegistry.get(policyId, policyVersion);
    if (!found) {
      findings.push({
        code: MIF_UCA_POLICY_UNAVAILABLE,
        severity: "blocking",
        message: `policy ${policyId}@${policyVersion} unavailable`,
      });
      return { policy: null, findings };
    }
    return { policy: found, findings };
  }
  if (policyId === MIF_CHART_ANALYSIS_POLICY_ID && policyVersion === MIF_CHART_ANALYSIS_POLICY_VERSION) {
    return { policy: MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS, findings };
  }
  findings.push({
    code: MIF_UCA_POLICY_UNAVAILABLE,
    severity: "blocking",
    message: `policy ${policyId}@${policyVersion} unavailable (no registry)`,
  });
  return { policy: null, findings };
}

function emptySourceRefs(): MifUnifiedSourceRefs {
  return {
    pattern: null,
    fibonacci: null,
    quality: {
      sourceKind: null,
      status: "MISSING",
      inputIdentity: null,
      assessmentId: null,
    },
  };
}

function buildAssessment(input: {
  providerSymbol: string;
  timeframe: string;
  instrument: MifCanonicalInstrument | null;
  policy: MifUnifiedChartAnalysisPolicy | null;
  status: MifUnifiedChartAnalysisStatus;
  findings: MifUnifiedChartAnalysisFinding[];
  sourceRefs: MifUnifiedSourceRefs;
  relationships: MifUnifiedChartAnalysisAssessment["relationships"];
  confluence: MifUnifiedChartAnalysisAssessment["confluence"];
  preservedPatternLifecycles: MifUnifiedChartAnalysisAssessment["preservedPatternLifecycles"];
  diagnostics: MifUnifiedChartAnalysisAssessment["diagnostics"];
  assessmentTimestamp: string;
  assessmentId?: string;
}): MifUnifiedChartAnalysisAssessment {
  const policyForIdentity = input.policy ?? MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS;
  const inputIdentity = computeUnifiedChartAnalysisInputIdentity({
    contractId: MIF_CHART_ANALYSIS_CONTRACT_ID,
    contractVersion: MIF_CHART_ANALYSIS_CONTRACT_VERSION,
    engineId: MIF_CHART_ANALYSIS_ENGINE_ID,
    engineVersion: MIF_CHART_ANALYSIS_ENGINE_VERSION,
    policy: policyForIdentity,
    providerSymbol: input.providerSymbol,
    timeframe: input.timeframe,
    patternInputIdentity: input.sourceRefs.pattern?.inputIdentity ?? null,
    fibonacciInputIdentity: input.sourceRefs.fibonacci?.inputIdentity ?? null,
    qualityInputIdentity: input.sourceRefs.quality.inputIdentity,
    relationshipIds: relationshipIdsOf(input.relationships),
    confluenceGrade: input.confluence.grade,
  });
  return {
    contractId: MIF_CHART_ANALYSIS_CONTRACT_ID,
    contractVersion: MIF_CHART_ANALYSIS_CONTRACT_VERSION,
    scope: "step1c-unified-chart-analysis",
    assessmentId: input.assessmentId ?? `uca:${inputIdentity.slice(0, 16)}`,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    timeframe: String(input.timeframe || "").trim(),
    instrument: input.instrument,
    policyId: input.policy?.policyId ?? null,
    policyVersion: input.policy?.policyVersion ?? null,
    engineId: MIF_CHART_ANALYSIS_ENGINE_ID,
    engineVersion: MIF_CHART_ANALYSIS_ENGINE_VERSION,
    assessmentTimestamp: input.assessmentTimestamp,
    status: input.status,
    sourceRefs: input.sourceRefs,
    relationships: input.relationships,
    confluence: input.confluence,
    preservedPatternLifecycles: input.preservedPatternLifecycles,
    findings: input.findings,
    warningCodes: input.findings.filter((f) => f.severity === "warning").map((f) => f.code),
    blockingCodes: input.findings.filter((f) => f.severity === "blocking").map((f) => f.code),
    diagnostics: input.diagnostics,
    diagnosticsSummary: input.diagnostics.overallStatusReason,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalIntegrationOnly: true,
  };
}

function validateCompatibility(
  pattern: MifChartPatternAssessment,
  fibonacci: MifFibonacciAssessment,
  policy: MifUnifiedChartAnalysisPolicy,
  sharedCanonicalSnapshotIdentity: string | null | undefined,
): { ok: boolean; findings: MifUnifiedChartAnalysisFinding[] } {
  const findings: MifUnifiedChartAnalysisFinding[] = [];

  if (
    pattern.contractId !== policy.acceptedPatternContractId
    || pattern.contractVersion !== policy.acceptedPatternContractVersion
  ) {
    findings.push({
      code: MIF_UCA_CONTRACT_INCOMPATIBLE,
      severity: "blocking",
      message: "pattern contract incompatible with unified policy",
      evidence: { contractId: pattern.contractId, contractVersion: pattern.contractVersion },
    });
  }
  if (
    fibonacci.contractId !== policy.acceptedFibonacciContractId
    || fibonacci.contractVersion !== policy.acceptedFibonacciContractVersion
  ) {
    findings.push({
      code: MIF_UCA_CONTRACT_INCOMPATIBLE,
      severity: "blocking",
      message: "fibonacci contract incompatible with unified policy",
      evidence: { contractId: fibonacci.contractId, contractVersion: fibonacci.contractVersion },
    });
  }
  if (pattern.providerId !== MIF_PROVIDER_ID || fibonacci.providerId !== MIF_PROVIDER_ID) {
    findings.push({
      code: MIF_UCA_PROVIDER_MISMATCH,
      severity: "blocking",
      message: "provider must be HFM_MT5 on both assessments",
    });
  }
  if (policy.providerId !== MIF_PROVIDER_ID) {
    findings.push({
      code: MIF_UCA_PROVIDER_MISMATCH,
      severity: "blocking",
      message: "policy provider is not HFM_MT5",
    });
  }
  const pSym = String(pattern.providerSymbol || "").trim().toUpperCase();
  const fSym = String(fibonacci.providerSymbol || "").trim().toUpperCase();
  if (pSym !== fSym) {
    findings.push({
      code: MIF_UCA_SYMBOL_MISMATCH,
      severity: "blocking",
      message: "providerSymbol mismatch between pattern and fibonacci assessments",
      evidence: { patternSymbol: pSym, fibonacciSymbol: fSym },
    });
  }
  if (String(pattern.timeframe || "").trim() !== String(fibonacci.timeframe || "").trim()) {
    findings.push({
      code: MIF_UCA_TIMEFRAME_MISMATCH,
      severity: "blocking",
      message: "timeframe mismatch between pattern and fibonacci assessments",
      evidence: { patternTf: pattern.timeframe, fibonacciTf: fibonacci.timeframe },
    });
  }

  if (policy.requireMatchingQualityInputIdentity) {
    const pq = pattern.qualityRef.inputIdentity;
    const fq = fibonacci.qualityRef.inputIdentity;
    if (pq && fq && pq !== fq) {
      findings.push({
        code: MIF_UCA_SNAPSHOT_MISMATCH,
        severity: "blocking",
        message: "quality inputIdentity mismatch — assessments are not from the same quality snapshot",
      });
    }
  }

  if (sharedCanonicalSnapshotIdentity != null && String(sharedCanonicalSnapshotIdentity).trim()) {
    // When an explicit shared snapshot is supplied, both source identities must be present
    // and the shared id is recorded as the compatibility key (does not invent candle data).
    if (!pattern.inputIdentity || !fibonacci.inputIdentity) {
      findings.push({
        code: MIF_UCA_SNAPSHOT_MISMATCH,
        severity: "blocking",
        message: "sharedCanonicalSnapshotIdentity supplied but source inputIdentity missing",
      });
    }
  }

  return { ok: findings.length === 0, findings };
}

/**
 * Unify STEP 1A Fibonacci + STEP 1B chart-pattern assessments with explainable confluence.
 */
export function assessMifUnifiedChartAnalysis(
  input: AssessMifUnifiedChartAnalysisInput,
): MifUnifiedChartAnalysisAssessment {
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const { policy, findings: policyFindings } = resolvePolicy(input);

  if (!policy) {
    const confluence = calculateConfluence({
      relationships: [],
      policy: MIF_POLICY_HFM_UNIFIED_CHART_ANALYSIS,
      qualityStatus: "MISSING",
      incompatible: true,
    });
    return buildAssessment({
      providerSymbol: input.pattern?.providerSymbol ?? input.fibonacci?.providerSymbol ?? "",
      timeframe: input.pattern?.timeframe ?? input.fibonacci?.timeframe ?? "",
      instrument: input.pattern?.instrument ?? input.fibonacci?.instrument ?? null,
      policy: null,
      status: "BLOCKED",
      findings: policyFindings,
      sourceRefs: emptySourceRefs(),
      relationships: [],
      confluence,
      preservedPatternLifecycles: [],
      diagnostics: buildUnifiedChartAnalysisDiagnostics({
        reason: policyFindings[0]?.message ?? "policy unavailable",
        compatible: false,
        relationshipCount: 0,
        withinToleranceCount: 0,
        atrUsed: null,
        referenceTimeSec: null,
      }),
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  if (!input.pattern || !input.fibonacci) {
    const findings: MifUnifiedChartAnalysisFinding[] = [
      ...policyFindings,
      {
        code: MIF_UCA_SOURCE_MISSING,
        severity: "blocking",
        message: !input.pattern && !input.fibonacci
          ? "pattern and fibonacci assessments missing"
          : !input.pattern
            ? "pattern assessment missing"
            : "fibonacci assessment missing",
      },
    ];
    const confluence = calculateConfluence({
      relationships: [],
      policy,
      qualityStatus: "MISSING",
      incompatible: true,
    });
    return buildAssessment({
      providerSymbol: input.pattern?.providerSymbol ?? input.fibonacci?.providerSymbol ?? "",
      timeframe: input.pattern?.timeframe ?? input.fibonacci?.timeframe ?? "",
      instrument: input.pattern?.instrument ?? input.fibonacci?.instrument ?? null,
      policy,
      status: "INSUFFICIENT_DATA",
      findings,
      sourceRefs: {
        pattern: input.pattern
          ? {
            assessmentId: input.pattern.assessmentId,
            inputIdentity: input.pattern.inputIdentity,
            status: input.pattern.status,
            contractId: input.pattern.contractId,
            contractVersion: input.pattern.contractVersion,
          }
          : null,
        fibonacci: input.fibonacci
          ? {
            assessmentId: input.fibonacci.assessmentId,
            inputIdentity: input.fibonacci.inputIdentity,
            status: input.fibonacci.status,
            contractId: input.fibonacci.contractId,
            contractVersion: input.fibonacci.contractVersion,
          }
          : null,
        quality: {
          sourceKind: null,
          status: "MISSING",
          inputIdentity: null,
          assessmentId: null,
        },
      },
      relationships: [],
      confluence,
      preservedPatternLifecycles: [],
      diagnostics: buildUnifiedChartAnalysisDiagnostics({
        reason: findings[findings.length - 1]!.message,
        compatible: false,
        relationshipCount: 0,
        withinToleranceCount: 0,
        atrUsed: null,
        referenceTimeSec: null,
      }),
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  const pattern = input.pattern;
  const fibonacci = input.fibonacci;
  const compat = validateCompatibility(
    pattern,
    fibonacci,
    policy,
    input.sharedCanonicalSnapshotIdentity,
  );

  const unifiedQuality = deriveUnifiedQualityStatus({
    patternQuality: pattern.qualityRef.status,
    fibonacciQuality: fibonacci.qualityRef.status,
  });

  const sourceRefs: MifUnifiedSourceRefs = {
    pattern: {
      assessmentId: pattern.assessmentId,
      inputIdentity: pattern.inputIdentity,
      status: pattern.status,
      contractId: pattern.contractId,
      contractVersion: pattern.contractVersion,
    },
    fibonacci: {
      assessmentId: fibonacci.assessmentId,
      inputIdentity: fibonacci.inputIdentity,
      status: fibonacci.status,
      contractId: fibonacci.contractId,
      contractVersion: fibonacci.contractVersion,
    },
    quality: {
      sourceKind: "derived",
      status: unifiedQuality,
      inputIdentity: pattern.qualityRef.inputIdentity ?? fibonacci.qualityRef.inputIdentity,
      assessmentId: pattern.qualityRef.assessmentId ?? fibonacci.qualityRef.assessmentId,
    },
  };

  const preservedPatternLifecycles = pattern.detections.map((d) => ({
    detectionIdentity: d.detectionIdentity,
    patternType: d.patternType,
    lifecycle: d.lifecycle,
  }));

  const findings: MifUnifiedChartAnalysisFinding[] = [...policyFindings, ...compat.findings];

  if (unifiedQuality === "MISSING") {
    findings.push({
      code: MIF_UCA_QUALITY_MISSING,
      severity: "blocking",
      message: "source quality status missing",
    });
  }
  if (unifiedQuality === "BLOCKED") {
    findings.push({
      code: MIF_UCA_QUALITY_BLOCKED,
      severity: "blocking",
      message: "source quality BLOCKED — unified assessment blocked",
    });
  }

  if (!compat.ok) {
    findings.push({
      code: MIF_UCA_SOURCE_INCOMPATIBLE,
      severity: "blocking",
      message: "pattern and fibonacci assessments are incompatible for correlation",
    });
    const confluence = calculateConfluence({
      relationships: [],
      policy,
      qualityStatus: unifiedQuality,
      incompatible: true,
    });
    const agg = aggregateUnifiedStatus({
      policy,
      compatible: false,
      patternStatus: pattern.status,
      fibonacciStatus: fibonacci.status,
      unifiedQuality,
      missingSource: false,
    });
    return buildAssessment({
      providerSymbol: pattern.providerSymbol,
      timeframe: pattern.timeframe,
      instrument: pattern.instrument ?? fibonacci.instrument,
      policy,
      status: agg.status,
      findings,
      sourceRefs,
      relationships: [],
      confluence,
      preservedPatternLifecycles,
      diagnostics: buildUnifiedChartAnalysisDiagnostics({
        reason: agg.reason,
        compatible: false,
        relationshipCount: 0,
        withinToleranceCount: 0,
        atrUsed: null,
        referenceTimeSec: null,
      }),
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  const { relationships, referenceTimeSec, atrUsed } = correlatePatternFibonacci({
    pattern,
    fibonacci,
    policy,
  });
  const confluence = calculateConfluence({
    relationships,
    policy,
    qualityStatus: unifiedQuality,
  });

  if (relationships.length === 0) {
    findings.push({
      code: MIF_UCA_NO_RELATIONSHIPS,
      severity: "info",
      message: "no pattern/Fibonacci relationships produced",
    });
  } else {
    findings.push({
      code: MIF_UCA_OK,
      severity: "info",
      message: `correlated ${relationships.length} relationship row(s); confluence grade=${confluence.grade}`,
    });
  }

  const agg = aggregateUnifiedStatus({
    policy,
    compatible: true,
    patternStatus: pattern.status,
    fibonacciStatus: fibonacci.status,
    unifiedQuality,
    missingSource: false,
  });

  return buildAssessment({
    providerSymbol: pattern.providerSymbol,
    timeframe: pattern.timeframe,
    instrument: pattern.instrument ?? fibonacci.instrument,
    policy,
    status: agg.status,
    findings,
    sourceRefs,
    relationships,
    confluence,
    preservedPatternLifecycles,
    diagnostics: buildUnifiedChartAnalysisDiagnostics({
      reason: agg.reason,
      compatible: true,
      relationshipCount: relationships.length,
      withinToleranceCount: confluence.components.withinToleranceCount,
      atrUsed,
      referenceTimeSec,
    }),
    assessmentTimestamp,
    assessmentId: input.assessmentId,
  });
}

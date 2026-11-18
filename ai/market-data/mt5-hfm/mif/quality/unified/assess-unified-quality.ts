/**
 * Phase 5B.2 Step 3 — unified MIF quality assessment.
 * Combines Step 1/2 assessments + policy evaluation + optional Phase 2 shadow.
 * Fixed: doesNotApproveAiReasoning = true. Never mutates Phase 2.
 */
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_QUALITY_CONTRACT_ID,
  MIF_QUALITY_CONTRACT_VERSION,
  MIF_QUALITY_STEP3_UNIFIED_ENGINE_ID,
  MIF_QUALITY_STEP3_UNIFIED_ENGINE_VERSION,
  MIF_UNIFIED_QUALITY_CONTRACT_ID,
  MIF_UNIFIED_QUALITY_CONTRACT_VERSION,
} from "../contracts.js";
import {
  MIF_QI_CONTRACT_INCOMPATIBLE,
  MIF_QI_POLICY_INVALID,
  MIF_QI_POLICY_UNAVAILABLE,
  MIF_QI_PROVIDER_SCOPE_MISMATCH,
  MIF_QI_SHADOW_DISAGREEMENT,
  MIF_QI_SYMBOL_SCOPE_MISMATCH,
} from "../codes.js";
import { evaluateMifQualityPolicy } from "../policy/evaluate-policy.js";
import { validateMifQualityPolicy } from "../policy/validate-policy.js";
import {
  attachUnifiedOverallToShadow,
  comparePhase2Shadow,
} from "../shadow/phase2-shadow-bridge.js";
import { deriveScopedQualityStatus, uniqueFindingCodes } from "../status.js";
import type { MifQualityFinding, MifQualityMetric } from "../types.js";
import { buildUnifiedDiagnostics } from "./diagnostics.js";
import { unifiedIdentityFromAssessInput } from "./stable-identity.js";
import type { AssessMifUnifiedQualityInput, MifUnifiedQualityAssessment } from "./types.js";

function assertSubsystemCompat(
  findings: MifQualityFinding[],
  symbol: string,
  assessment: {
    contractId: string;
    contractVersion: string;
    providerId: string;
    providerSymbol: string;
    scope: string;
  } | null,
  label: string,
): void {
  if (!assessment) return;
  if (assessment.contractId !== MIF_QUALITY_CONTRACT_ID) {
    findings.push({
      code: MIF_QI_CONTRACT_INCOMPATIBLE,
      severity: "blocking",
      message: `${label} contractId ${assessment.contractId} != ${MIF_QUALITY_CONTRACT_ID}`,
    });
  }
  if (assessment.contractVersion !== MIF_QUALITY_CONTRACT_VERSION) {
    findings.push({
      code: MIF_QI_CONTRACT_INCOMPATIBLE,
      severity: "blocking",
      message: `${label} contractVersion ${assessment.contractVersion} != ${MIF_QUALITY_CONTRACT_VERSION}`,
    });
  }
  if (assessment.providerId !== MIF_PROVIDER_ID) {
    findings.push({
      code: MIF_QI_PROVIDER_SCOPE_MISMATCH,
      severity: "blocking",
      message: `${label} providerId ${assessment.providerId} != HFM_MT5`,
    });
  }
  if (assessment.providerSymbol.toUpperCase() !== symbol) {
    findings.push({
      code: MIF_QI_SYMBOL_SCOPE_MISMATCH,
      severity: "blocking",
      message: `${label} symbol ${assessment.providerSymbol} != ${symbol}`,
    });
  }
}

/**
 * Public Step 3 entry point.
 */
export function assessMifUnifiedQuality(
  input: AssessMifUnifiedQualityInput,
): MifUnifiedQualityAssessment {
  const symbol = String(input.providerSymbol || "").trim().toUpperCase();
  const findings: MifQualityFinding[] = [];
  const dataIntegrity = input.dataIntegrity ?? null;
  const quote = input.quote ?? null;
  const instrument = input.instrument ?? null;
  const multiTimeframe = input.multiTimeframe ?? null;

  assertSubsystemCompat(findings, symbol, dataIntegrity, "dataIntegrity");
  assertSubsystemCompat(findings, symbol, quote, "quote");
  assertSubsystemCompat(findings, symbol, instrument, "instrument");
  assertSubsystemCompat(findings, symbol, multiTimeframe, "multiTimeframe");

  // Consumer id consistency when MTF present
  if (multiTimeframe && multiTimeframe.consumerId !== input.consumerId) {
    findings.push({
      code: MIF_QI_CONTRACT_INCOMPATIBLE,
      severity: "blocking",
      message: `multiTimeframe.consumerId ${multiTimeframe.consumerId} != unified consumerId ${input.consumerId}`,
    });
  }

  let selectedPolicy = input.policyRegistry.get(input.policyId, input.policyVersion);
  let policyEvaluation = null as ReturnType<typeof evaluateMifQualityPolicy>["result"] | null;

  if (!selectedPolicy) {
    findings.push({
      code: MIF_QI_POLICY_UNAVAILABLE,
      severity: "blocking",
      message: `policy ${input.policyId}@${input.policyVersion} not found in registry`,
    });
  } else {
    const validated = validateMifQualityPolicy(selectedPolicy);
    if (!validated.ok) {
      findings.push({
        code: MIF_QI_POLICY_INVALID,
        severity: "blocking",
        message: validated.issues.map((i) => i.message).join("; "),
      });
      selectedPolicy = null;
    } else if (validated.policy.consumerId !== input.consumerId) {
      findings.push({
        code: MIF_QI_CONTRACT_INCOMPATIBLE,
        severity: "blocking",
        message: `policy consumerId ${validated.policy.consumerId} != ${input.consumerId}`,
      });
    } else if (validated.policy.providerId !== MIF_PROVIDER_ID) {
      findings.push({
        code: MIF_QI_PROVIDER_SCOPE_MISMATCH,
        severity: "blocking",
        message: "policy provider scope is not HFM_MT5",
      });
    } else {
      const evaluated = evaluateMifQualityPolicy({
        policy: validated.policy,
        dataIntegrity,
        quote,
        instrument,
        multiTimeframe,
      });
      findings.push(...evaluated.findings);
      policyEvaluation = evaluated.result;
      selectedPolicy = validated.policy;
    }
  }

  // Optional shadow (observational)
  let shadow = null as ReturnType<typeof comparePhase2Shadow> | null;
  if (input.phase2Quality) {
    shadow = comparePhase2Shadow({
      dataIntegrity,
      quote,
      multiTimeframe,
      phase2Quality: input.phase2Quality,
      phase2Sync: input.phase2Sync ?? null,
      phase2SourceIdentity: input.phase2SourceIdentity ?? null,
      providerSymbol: symbol,
      assessmentTimestamp: input.assessmentTimestamp,
    });
  }

  const status = deriveScopedQualityStatus(findings);

  if (shadow) {
    shadow = attachUnifiedOverallToShadow(shadow, input.phase2Quality!, status);
    if (shadow.hasGenuineDisagreement) {
      findings.push({
        code: MIF_QI_SHADOW_DISAGREEMENT,
        severity: "info",
        message: "Phase 2 shadow bridge observed genuine disagreement (observational only)",
      });
    }
  }

  // Shadow disagreement is informational and must not change overall status.
  const overallStatus = status;

  const inputIdentity = unifiedIdentityFromAssessInput(input, shadow?.inputIdentity ?? null);
  const presentSubsystems = [
    dataIntegrity ? "data_integrity" : null,
    quote ? "quote" : null,
    instrument ? "instrument" : null,
    multiTimeframe ? "multi_timeframe" : null,
  ].filter((x): x is string => x != null);

  const diagnostics = buildUnifiedDiagnostics({
    status: overallStatus,
    findings,
    policyEvaluation,
    shadowDisagreement: shadow ? shadow.hasGenuineDisagreement : null,
    presentSubsystems,
  });

  const metrics: MifQualityMetric[] = [
    {
      metricId: "overall_status",
      value: overallStatus,
      unit: "enum",
      status:
        overallStatus === "BLOCKED"
          ? "blocked"
          : overallStatus === "DEGRADED"
            ? "degraded"
            : overallStatus === "WARNING"
              ? "warning"
              : "ok",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
    {
      metricId: "policy_available",
      value: selectedPolicy != null,
      unit: "boolean",
      status: selectedPolicy ? "ok" : "blocked",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
    {
      metricId: "shadow_disagreement",
      value: shadow?.hasGenuineDisagreement ?? null,
      unit: "boolean",
      status: shadow == null ? "not_applicable" : "ok",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
  ];

  return {
    contractId: MIF_UNIFIED_QUALITY_CONTRACT_ID,
    contractVersion: MIF_UNIFIED_QUALITY_CONTRACT_VERSION,
    scope: "step3-unified-quality",
    assessmentId: input.assessmentId ?? `step3-unified:${inputIdentity.slice(0, 16)}`,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: symbol,
    consumerId: input.consumerId,
    policyId: selectedPolicy?.policyId ?? input.policyId,
    policyVersion: selectedPolicy?.policyVersion ?? input.policyVersion,
    engineId: MIF_QUALITY_STEP3_UNIFIED_ENGINE_ID,
    engineVersion: MIF_QUALITY_STEP3_UNIFIED_ENGINE_VERSION,
    assessmentTimestamp: input.assessmentTimestamp ?? new Date().toISOString(),
    status: overallStatus,
    subsystems: {
      dataIntegrity,
      quote,
      instrument,
      multiTimeframe,
    },
    policyEvaluation,
    selectedPolicy,
    shadow,
    metrics,
    findings,
    warningCodes: uniqueFindingCodes(findings, (f) => f.severity === "warning" || f.severity === "info"),
    blockingCodes: uniqueFindingCodes(findings, (f) => f.severity === "blocking"),
    uncertaintyCodes: uniqueFindingCodes(
      findings,
      (f) =>
        f.code === MIF_QI_POLICY_UNAVAILABLE ||
        f.code === "POLICY_UNCERTAINTY" ||
        f.code === "TIMEBASE_UNCERTAIN" ||
        f.code === "NO_AUTHORITATIVE_SESSION_CALENDAR",
    ),
    diagnostics,
    diagnosticsSummary: diagnostics.overallStatusReason,
    doesNotApproveAiReasoning: true,
    notPhase2AiGate: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

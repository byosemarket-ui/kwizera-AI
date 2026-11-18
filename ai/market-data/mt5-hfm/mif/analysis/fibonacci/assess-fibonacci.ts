/**
 * Phase 5C Step 1A — assessMifFibonacci public entry.
 * Deterministic, read-only, HFM_MT5 only. Does not approve AI reasoning or execution.
 */
import { DEFAULT_STRUCTURE_PARAMS, mergeStructureParams } from "../../../../../forex-structure/params.js";
import { detectSwings } from "../../../../../forex-structure/swings.js";
import type { StructureRuleParams } from "../../../../../forex-structure/types.js";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import { precisionOk, tickAligned } from "../../../quote-validation.js";
import { checkPricesAgainstInstrument } from "../../quality/instrument/price-precision.js";
import type { MifStep1DataIntegrityAssessment } from "../../quality/types.js";
import type { MifUnifiedQualityAssessment } from "../../quality/unified/types.js";
import { mifCandlesToStructureCandles } from "../adapter/mif-to-structure-candle.js";
import {
  evaluateMifAnalyticalQualityGate,
  type MifQualityGateSource,
} from "../quality/assessment-quality-gate.js";
import {
  MIF_FIB_ADAPTER_BLOCKED,
  MIF_FIB_ANCHOR_INVALID,
  MIF_FIB_INSUFFICIENT_SWINGS,
  MIF_FIB_INSTRUMENT_MISSING,
  MIF_FIB_INSTRUMENT_MISMATCH,
  MIF_FIB_LEVEL_PRECISION_MISMATCH,
  MIF_FIB_LEVEL_TICK_MISMATCH,
  MIF_FIB_NO_CONFIRMED_IMPULSE,
  MIF_FIB_OK,
  MIF_FIB_POLICY_INVALID,
  MIF_FIB_POLICY_UNAVAILABLE,
  MIF_FIB_PRECISION_UNAVAILABLE,
  MIF_FIB_PROVIDER_MISMATCH,
  MIF_FIB_QUALITY_BLOCKED,
  MIF_FIB_QUALITY_DISALLOWS_CONFIRMED,
  MIF_FIB_QUALITY_MISSING,
  type MifFibonacciReasonCode,
} from "./codes.js";
import {
  MIF_FIBONACCI_CONTRACT_ID,
  MIF_FIBONACCI_CONTRACT_VERSION,
  MIF_FIBONACCI_ENGINE_ID,
  MIF_FIBONACCI_ENGINE_VERSION,
  MIF_FIBONACCI_POLICY_ID,
  MIF_FIBONACCI_POLICY_VERSION,
} from "./contracts.js";
import { computeFibLevels } from "./levels.js";
import {
  MIF_POLICY_HFM_FIBONACCI,
  validateMifFibonacciPolicy,
  type MifFibonacciPolicyRegistry,
} from "./policies.js";
import { selectLatestAdjacentConfirmedImpulse } from "./select-anchors.js";
import { computeFibonacciInputIdentity } from "./stable-identity.js";
import type {
  MifFibonacciAssessment,
  MifFibonacciAssessmentStatus,
  MifFibonacciFinding,
  MifFibonacciLevel,
  MifFibonacciPolicy,
} from "./types.js";

export interface AssessMifFibonacciInput {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  instrument?: MifCanonicalInstrument | null;
  /**
   * Required MIF quality assessment (Step 1 integrity or Step 3 unified).
   * Missing → fail closed.
   */
  quality:
    | { kind: "step1-data-integrity"; assessment: MifStep1DataIntegrityAssessment }
    | { kind: "step3-unified-quality"; assessment: MifUnifiedQualityAssessment }
    | null;
  /** When omitted, uses built-in mif-hfm-fibonacci@1.0.0 if registry not supplied. */
  policy?: MifFibonacciPolicy | null;
  policyId?: string;
  policyVersion?: string;
  policyRegistry?: MifFibonacciPolicyRegistry | null;
  structureParams?: Partial<StructureRuleParams>;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

function emptyDiagnostics(partial?: Partial<MifFibonacciAssessment["diagnostics"]>): MifFibonacciAssessment["diagnostics"] {
  return {
    overallStatusReason: partial?.overallStatusReason ?? "incomplete",
    selectedPairIndex: partial?.selectedPairIndex ?? null,
    confirmedSwingCount: partial?.confirmedSwingCount ?? 0,
    provisionalSwingCount: partial?.provisionalSwingCount ?? 0,
    candidateImpulseCount: partial?.candidateImpulseCount ?? 0,
    digitsUsed: partial?.digitsUsed ?? null,
    tickSizeUsed: partial?.tickSizeUsed ?? null,
    levelPrecisionMismatchCount: partial?.levelPrecisionMismatchCount ?? 0,
    levelTickMismatchCount: partial?.levelTickMismatchCount ?? 0,
  };
}

function buildAssessment(input: {
  providerSymbol: string;
  timeframe: string;
  instrument: MifCanonicalInstrument | null;
  policy: MifFibonacciPolicy | null;
  status: MifFibonacciAssessmentStatus;
  findings: MifFibonacciFinding[];
  qualityRef: MifFibonacciAssessment["qualityRef"];
  orientation: MifFibonacciAssessment["orientation"];
  anchorA: MifFibonacciAssessment["anchorA"];
  anchorB: MifFibonacciAssessment["anchorB"];
  retracements: MifFibonacciLevel[];
  extensions: MifFibonacciLevel[];
  diagnostics: MifFibonacciAssessment["diagnostics"];
  candles: readonly MifCanonicalCandle[];
  assessmentTimestamp: string;
  assessmentId?: string;
}): MifFibonacciAssessment {
  const policyForIdentity = input.policy ?? MIF_POLICY_HFM_FIBONACCI;
  const inputIdentity = computeFibonacciInputIdentity({
    contractId: MIF_FIBONACCI_CONTRACT_ID,
    contractVersion: MIF_FIBONACCI_CONTRACT_VERSION,
    engineId: MIF_FIBONACCI_ENGINE_ID,
    engineVersion: MIF_FIBONACCI_ENGINE_VERSION,
    policy: policyForIdentity,
    providerSymbol: input.providerSymbol,
    timeframe: input.timeframe,
    candles: input.candles,
    qualityInputIdentity: input.qualityRef.inputIdentity,
    orientation: input.orientation,
    anchorA: input.anchorA,
    anchorB: input.anchorB,
    instrumentDigits: input.instrument?.digits ?? null,
    instrumentTickSize: input.instrument?.tickSize ?? null,
  });

  const warningCodes = input.findings
    .filter((f) => f.severity === "warning")
    .map((f) => f.code);
  const blockingCodes = input.findings
    .filter((f) => f.severity === "blocking")
    .map((f) => f.code);

  return {
    contractId: MIF_FIBONACCI_CONTRACT_ID,
    contractVersion: MIF_FIBONACCI_CONTRACT_VERSION,
    scope: "step1a-fibonacci",
    assessmentId: input.assessmentId ?? `fib:${inputIdentity.slice(0, 16)}`,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    timeframe: String(input.timeframe || "").trim(),
    instrument: input.instrument,
    policyId: input.policy?.policyId ?? null,
    policyVersion: input.policy?.policyVersion ?? null,
    engineId: MIF_FIBONACCI_ENGINE_ID,
    engineVersion: MIF_FIBONACCI_ENGINE_VERSION,
    assessmentTimestamp: input.assessmentTimestamp,
    status: input.status,
    orientation: input.orientation,
    anchorA: input.anchorA,
    anchorB: input.anchorB,
    retracements: input.retracements,
    extensions: input.extensions,
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
    mathematicalReferenceOnly: true,
  };
}

function resolvePolicy(input: AssessMifFibonacciInput): {
  policy: MifFibonacciPolicy | null;
  findings: MifFibonacciFinding[];
} {
  const findings: MifFibonacciFinding[] = [];
  if (input.policy) {
    const v = validateMifFibonacciPolicy(input.policy);
    if (!v.ok) {
      findings.push({
        code: MIF_FIB_POLICY_INVALID,
        severity: "blocking",
        message: `invalid policy: ${v.errors.join("; ")}`,
      });
      return { policy: null, findings };
    }
    return { policy: input.policy, findings };
  }

  const policyId = input.policyId ?? MIF_FIBONACCI_POLICY_ID;
  const policyVersion = input.policyVersion ?? MIF_FIBONACCI_POLICY_VERSION;
  if (input.policyRegistry) {
    const found = input.policyRegistry.get(policyId, policyVersion);
    if (!found) {
      findings.push({
        code: MIF_FIB_POLICY_UNAVAILABLE,
        severity: "blocking",
        message: `policy ${policyId}@${policyVersion} unavailable`,
      });
      return { policy: null, findings };
    }
    const v = validateMifFibonacciPolicy(found);
    if (!v.ok) {
      findings.push({
        code: MIF_FIB_POLICY_INVALID,
        severity: "blocking",
        message: `invalid registry policy: ${v.errors.join("; ")}`,
      });
      return { policy: null, findings };
    }
    return { policy: found, findings };
  }

  // Built-in when no registry and no explicit policy object — still validate.
  if (policyId === MIF_FIBONACCI_POLICY_ID && policyVersion === MIF_FIBONACCI_POLICY_VERSION) {
    return { policy: MIF_POLICY_HFM_FIBONACCI, findings };
  }
  findings.push({
    code: MIF_FIB_POLICY_UNAVAILABLE,
    severity: "blocking",
    message: `policy ${policyId}@${policyVersion} unavailable (no registry)`,
  });
  return { policy: null, findings };
}

function mapQualityFinding(
  reasonCode: string,
): { code: MifFibonacciReasonCode; severity: MifFibonacciFinding["severity"] } {
  if (reasonCode === "QUALITY_MISSING") {
    return { code: MIF_FIB_QUALITY_MISSING, severity: "blocking" };
  }
  if (reasonCode === "QUALITY_BLOCKED") {
    return { code: MIF_FIB_QUALITY_BLOCKED, severity: "blocking" };
  }
  if (reasonCode === "QUALITY_DISALLOWS_CONFIRMED") {
    return { code: MIF_FIB_QUALITY_DISALLOWS_CONFIRMED, severity: "blocking" };
  }
  if (reasonCode === "QUALITY_DEGRADED") {
    return { code: MIF_FIB_QUALITY_DISALLOWS_CONFIRMED, severity: "degraded" };
  }
  if (reasonCode === "QUALITY_WARNING") {
    return { code: MIF_FIB_OK, severity: "warning" };
  }
  return { code: MIF_FIB_OK, severity: "info" };
}

/**
 * Assess Fibonacci retracement/extension levels from confirmed HFM_MT5 swings.
 */
export function assessMifFibonacci(input: AssessMifFibonacciInput): MifFibonacciAssessment {
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
      qualityRef: {
        sourceKind: null,
        status: "MISSING",
        inputIdentity: null,
        assessmentId: null,
      },
      orientation: null,
      anchorA: null,
      anchorB: null,
      retracements: [],
      extensions: [],
      diagnostics: emptyDiagnostics({
        overallStatusReason: policyFindings[0]?.message ?? "policy unavailable",
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  if (policy.providerId !== MIF_PROVIDER_ID) {
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status: "BLOCKED",
      findings: [{
        code: MIF_FIB_PROVIDER_MISMATCH,
        severity: "blocking",
        message: "policy provider is not HFM_MT5",
      }],
      qualityRef: {
        sourceKind: null,
        status: "MISSING",
        inputIdentity: null,
        assessmentId: null,
      },
      orientation: null,
      anchorA: null,
      anchorB: null,
      retracements: [],
      extensions: [],
      diagnostics: emptyDiagnostics({ overallStatusReason: "provider mismatch" }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  const qualitySource = input.quality as MifQualityGateSource | null;
  const gate = evaluateMifAnalyticalQualityGate({
    quality: qualitySource,
    allowedStatusesForConfirmedAnchors: policy.allowedQualityStatusesForConfirmedAnchors,
  });

  const qualityRef: MifFibonacciAssessment["qualityRef"] = {
    sourceKind: gate.sourceKind,
    status: gate.qualityStatus,
    inputIdentity: gate.qualityInputIdentity,
    assessmentId: gate.qualityAssessmentId,
  };

  const findings: MifFibonacciFinding[] = [...policyFindings];
  if (!gate.allowsConfirmedAnchors) {
    const mapped = mapQualityFinding(gate.reasonCode);
    findings.push({
      code: mapped.code,
      severity: mapped.severity === "info" ? "blocking" : mapped.severity,
      message: gate.message,
    });
    const status: MifFibonacciAssessmentStatus =
      gate.qualityStatus === "BLOCKED"
        ? "BLOCKED"
        : gate.analyticalStatusHint === "BLOCKED"
          ? "BLOCKED"
          : "INSUFFICIENT_DATA";
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status,
      findings,
      qualityRef,
      orientation: null,
      anchorA: null,
      anchorB: null,
      retracements: [],
      extensions: [],
      diagnostics: emptyDiagnostics({
        overallStatusReason: gate.message,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  if (policy.requireInstrumentMetadata) {
    if (!instrument) {
      const sev = policy.missingInstrumentBehavior === "block" ? "blocking" : "degraded";
      findings.push({
        code: MIF_FIB_INSTRUMENT_MISSING,
        severity: sev,
        message: "instrument metadata required by policy but missing",
      });
      if (policy.missingInstrumentBehavior === "block") {
        return buildAssessment({
          providerSymbol,
          timeframe,
          instrument,
          policy,
          status: "BLOCKED",
          findings,
          qualityRef,
          orientation: null,
          anchorA: null,
          anchorB: null,
          retracements: [],
          extensions: [],
          diagnostics: emptyDiagnostics({ overallStatusReason: "instrument missing" }),
          candles,
          assessmentTimestamp,
          assessmentId: input.assessmentId,
        });
      }
    } else if (
      String(instrument.providerSymbol || "").trim().toUpperCase() !== providerSymbol
    ) {
      findings.push({
        code: MIF_FIB_INSTRUMENT_MISMATCH,
        severity: "blocking",
        message: "instrument symbol mismatch",
        evidence: {
          instrumentSymbol: instrument.providerSymbol,
          expectedSymbol: providerSymbol,
        },
      });
      return buildAssessment({
        providerSymbol,
        timeframe,
        instrument,
        policy,
        status: "BLOCKED",
        findings,
        qualityRef,
        orientation: null,
        anchorA: null,
        anchorB: null,
        retracements: [],
        extensions: [],
        diagnostics: emptyDiagnostics({ overallStatusReason: "instrument mismatch" }),
        candles,
        assessmentTimestamp,
        assessmentId: input.assessmentId,
      });
    } else if (instrument.providerId !== MIF_PROVIDER_ID) {
      findings.push({
        code: MIF_FIB_PROVIDER_MISMATCH,
        severity: "blocking",
        message: "instrument provider is not HFM_MT5",
      });
      return buildAssessment({
        providerSymbol,
        timeframe,
        instrument,
        policy,
        status: "BLOCKED",
        findings,
        qualityRef,
        orientation: null,
        anchorA: null,
        anchorB: null,
        retracements: [],
        extensions: [],
        diagnostics: emptyDiagnostics({ overallStatusReason: "instrument provider mismatch" }),
        candles,
        assessmentTimestamp,
        assessmentId: input.assessmentId,
      });
    }
  }

  const includeForming = policy.candleStatePolicy === "allow_forming_for_swings_only";
  const adapted = mifCandlesToStructureCandles({
    candles,
    providerSymbol,
    timeframe,
    includeForming,
  });

  if (adapted.blocking || !adapted.ok) {
    findings.push({
      code: MIF_FIB_ADAPTER_BLOCKED,
      severity: "blocking",
      message: adapted.issues[0]?.message ?? "structure adapter blocked",
      evidence: { issueCount: adapted.issues.length },
    });
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status: "BLOCKED",
      findings,
      qualityRef,
      orientation: null,
      anchorA: null,
      anchorB: null,
      retracements: [],
      extensions: [],
      diagnostics: emptyDiagnostics({ overallStatusReason: "adapter blocked" }),
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
    includeForming,
  );

  const selection = selectLatestAdjacentConfirmedImpulse(swings);
  if (!selection.selected) {
    const code =
      selection.confirmedCount < 2
        ? MIF_FIB_INSUFFICIENT_SWINGS
        : MIF_FIB_NO_CONFIRMED_IMPULSE;
    findings.push({
      code,
      severity: "blocking",
      message:
        selection.confirmedCount < 2
          ? "insufficient confirmed swings for Fibonacci anchors"
          : "no valid adjacent confirmed impulse pair",
      evidence: {
        confirmedSwingCount: selection.confirmedCount,
        provisionalSwingCount: selection.provisionalCount,
        candidateImpulseCount: selection.candidates.length,
      },
    });
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status: "INSUFFICIENT_DATA",
      findings,
      qualityRef,
      orientation: null,
      anchorA: null,
      anchorB: null,
      retracements: [],
      extensions: [],
      diagnostics: emptyDiagnostics({
        overallStatusReason: findings[findings.length - 1]!.message,
        confirmedSwingCount: selection.confirmedCount,
        provisionalSwingCount: selection.provisionalCount,
        candidateImpulseCount: selection.candidates.length,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  const impulse = selection.selected;
  const { orientation, anchorA, anchorB, low, high } = impulse;

  if (!(high > low) || !Number.isFinite(low) || !Number.isFinite(high)) {
    findings.push({
      code: MIF_FIB_ANCHOR_INVALID,
      severity: "blocking",
      message: "impulse range invalid",
      evidence: { low, high },
    });
    return buildAssessment({
      providerSymbol,
      timeframe,
      instrument,
      policy,
      status: "BLOCKED",
      findings,
      qualityRef,
      orientation,
      anchorA,
      anchorB,
      retracements: [],
      extensions: [],
      diagnostics: emptyDiagnostics({
        overallStatusReason: "invalid impulse range",
        confirmedSwingCount: selection.confirmedCount,
        provisionalSwingCount: selection.provisionalCount,
        candidateImpulseCount: selection.candidates.length,
        selectedPairIndex: impulse.endIndex,
      }),
      candles,
      assessmentTimestamp,
      assessmentId: input.assessmentId,
    });
  }

  // Anchor precision against instrument (no silent rounding).
  let digitsUsed: number | null = null;
  let tickSizeUsed: number | null = null;
  if (instrument) {
    const anchorCheck = checkPricesAgainstInstrument({
      instrument,
      expectedSymbol: providerSymbol,
      prices: [
        { label: "anchorA", value: anchorA.price, required: true },
        { label: "anchorB", value: anchorB.price, required: true },
      ],
      requirePositive: false,
    });
    digitsUsed = anchorCheck.digitsUsed;
    tickSizeUsed = anchorCheck.tickSizeUsed;
    if (!anchorCheck.verified) {
      const blocking = anchorCheck.findings.some((f) => f.severity === "blocking");
      const unavailable = anchorCheck.metadataSource === "unavailable"
        || anchorCheck.findings.some((f) => String(f.code).includes("PRECISION_UNAVAILABLE"));
      findings.push({
        code: unavailable ? MIF_FIB_PRECISION_UNAVAILABLE : MIF_FIB_ANCHOR_INVALID,
        severity: blocking || unavailable ? "blocking" : "degraded",
        message: anchorCheck.findings[0]?.message ?? "anchor precision check failed",
      });
      if (blocking || unavailable) {
        return buildAssessment({
          providerSymbol,
          timeframe,
          instrument,
          policy,
          status: "BLOCKED",
          findings,
          qualityRef,
          orientation,
          anchorA,
          anchorB,
          retracements: [],
          extensions: [],
          diagnostics: emptyDiagnostics({
            overallStatusReason: "anchor precision failed",
            confirmedSwingCount: selection.confirmedCount,
            provisionalSwingCount: selection.provisionalCount,
            candidateImpulseCount: selection.candidates.length,
            selectedPairIndex: impulse.endIndex,
            digitsUsed,
            tickSizeUsed,
          }),
          candles,
          assessmentTimestamp,
          assessmentId: input.assessmentId,
        });
      }
    }
  }

  const rawLevels = computeFibLevels({
    orientation,
    low,
    high,
    retracementRatios: policy.retracementRatios,
    extensionRatios: policy.extensionRatios,
  });

  let levelPrecisionMismatchCount = 0;
  let levelTickMismatchCount = 0;

  const annotate = (
    rows: Array<{ ratio: number; price: number }>,
    kind: "retracement" | "extension",
  ): MifFibonacciLevel[] =>
    rows.map((row) => {
      const pOk =
        digitsUsed == null ? null : precisionOk(row.price, digitsUsed);
      const tOk =
        tickSizeUsed == null ? null : tickAligned(row.price, tickSizeUsed);
      if (pOk === false) levelPrecisionMismatchCount += 1;
      if (tOk === false) levelTickMismatchCount += 1;
      return {
        ratio: row.ratio,
        price: row.price,
        kind,
        precisionOk: pOk,
        tickAligned: tOk,
      };
    });

  const retracements = annotate(rawLevels.retracements, "retracement");
  const extensions = annotate(rawLevels.extensions, "extension");

  if (policy.reportLevelPrecisionDiagnostics) {
    if (levelPrecisionMismatchCount > 0) {
      findings.push({
        code: MIF_FIB_LEVEL_PRECISION_MISMATCH,
        severity: "warning",
        message: `${levelPrecisionMismatchCount} Fibonacci level(s) exceed instrument digits (raw prices preserved)`,
        evidence: { count: levelPrecisionMismatchCount, digits: digitsUsed },
      });
    }
    if (levelTickMismatchCount > 0) {
      findings.push({
        code: MIF_FIB_LEVEL_TICK_MISMATCH,
        severity: "warning",
        message: `${levelTickMismatchCount} Fibonacci level(s) not tick-aligned (raw prices preserved)`,
        evidence: { count: levelTickMismatchCount, tickSize: tickSizeUsed },
      });
    }
  }

  let status: MifFibonacciAssessmentStatus = "VALID";
  if (
    policy.levelPrecisionMismatchElevatesWarning
    && (levelPrecisionMismatchCount > 0 || levelTickMismatchCount > 0)
  ) {
    status = "WARNING";
  }
  if (findings.some((f) => f.severity === "degraded")) {
    status = "DEGRADED";
  }
  if (gate.qualityStatus === "WARNING" && status === "VALID") {
    // Policy allowed WARNING for anchors — preserve warning, never upgrade quality.
    status = "WARNING";
    findings.push({
      code: MIF_FIB_OK,
      severity: "warning",
      message: "quality status WARNING preserved on Fibonacci assessment",
    });
  }

  findings.push({
    code: MIF_FIB_OK,
    severity: "info",
    message: `Fibonacci ${orientation} impulse levels computed (mathematical reference only)`,
  });

  return buildAssessment({
    providerSymbol,
    timeframe,
    instrument,
    policy,
    status,
    findings,
    qualityRef,
    orientation,
    anchorA,
    anchorB,
    retracements,
    extensions,
    diagnostics: {
      overallStatusReason:
        status === "VALID"
          ? `VALID ${orientation} Fibonacci assessment`
          : `${status}: level diagnostics or quality warning`,
      selectedPairIndex: impulse.endIndex,
      confirmedSwingCount: selection.confirmedCount,
      provisionalSwingCount: selection.provisionalCount,
      candidateImpulseCount: selection.candidates.length,
      digitsUsed,
      tickSizeUsed,
      levelPrecisionMismatchCount,
      levelTickMismatchCount,
    },
    candles,
    assessmentTimestamp,
    assessmentId: input.assessmentId,
  });
}

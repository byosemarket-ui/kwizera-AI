/**
 * Phase 5D Step 2 — runMifOpportunityDetection orchestrator.
 * Independent detectors; isolated failures; no ranking; no fake candidates.
 */
import type { MifStrategyId } from "../strategy-intelligence/types.js";
import {
  fingerprintContextEvidence,
  validateOpportunityCandidate,
} from "./candidate-identity.js";
import {
  MIF_OD_BLOCKED_BY_DATA_QUALITY,
  MIF_OD_CANDIDATE_INVALID,
  MIF_OD_CANDIDATE_PRODUCED,
  MIF_OD_DETECTOR_DISABLED,
  MIF_OD_DETECTOR_ERROR,
  MIF_OD_DETECTOR_NOT_REGISTERED,
  MIF_OD_DUPLICATE_CANDIDATE_ID,
  MIF_OD_INELIGIBLE,
  MIF_OD_INSUFFICIENT_EVIDENCE,
  MIF_OD_INVALID_CONTEXT,
  MIF_OD_NO_CANDIDATE,
  type MifOpportunityDetectionReasonCode,
} from "./codes.js";
import {
  MIF_OPPORTUNITY_DETECTION_CONTRACT_ID,
  MIF_OPPORTUNITY_DETECTION_CONTRACT_VERSION,
  MIF_OPPORTUNITY_DETECTION_ENGINE_ID,
  MIF_OPPORTUNITY_DETECTION_ENGINE_VERSION,
  MIF_OPPORTUNITY_DETECTION_POLICY_ID,
  MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
} from "./contracts.js";
import {
  createMifOpportunityDetectorRegistry,
  getDefaultMifOpportunityDetectorRegistry,
  type MifOpportunityDetectorRegistry,
} from "./detector-registry.js";
import { buildStrategyEvidenceSummaryFromContext } from "./evidence-summary.js";
import type {
  MifDetectionOutcome,
  MifOpportunityCandidate,
  MifOpportunityDetectionContext,
  MifOpportunityDetectionRunResult,
  MifOpportunityDetector,
} from "./types.js";
import { validateOpportunityDetectionContext } from "./validate-context.js";
import { validateDetectorEvidence } from "./validate-evidence.js";

function safetyOutcomeBase(): Pick<
  MifDetectionOutcome,
  "placesOrders" | "mutatesBroker" | "acceptsForExecution" | "doesNotApproveAiReasoning" | "analyticalOutcomeOnly"
> {
  return {
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalOutcomeOnly: true,
  };
}

function outcome(partial: Omit<MifDetectionOutcome, keyof ReturnType<typeof safetyOutcomeBase>> &
  Partial<ReturnType<typeof safetyOutcomeBase>>): MifDetectionOutcome {
  return {
    ...safetyOutcomeBase(),
    ...partial,
  };
}

function mapEligibilityToStatus(
  status: string,
): Pick<MifDetectionOutcome, "status" | "reasonCodes"> | null {
  switch (status) {
    case "ELIGIBLE_FOR_DETECTION":
      return null;
    case "INSUFFICIENT_EVIDENCE":
      return { status: "INSUFFICIENT_EVIDENCE", reasonCodes: [MIF_OD_INSUFFICIENT_EVIDENCE] };
    case "BLOCKED_BY_DATA_QUALITY":
      return { status: "BLOCKED_BY_DATA_QUALITY", reasonCodes: [MIF_OD_BLOCKED_BY_DATA_QUALITY] };
    case "DISABLED":
    case "DEPRECATED":
    case "DRAFT":
    case "INELIGIBLE":
    default:
      return { status: "INELIGIBLE", reasonCodes: [MIF_OD_INELIGIBLE] };
  }
}

function runOneDetector(input: {
  detector: MifOpportunityDetector;
  context: MifOpportunityDetectionContext;
  registry: MifOpportunityDetectorRegistry;
  evaluationTimestamp: string;
  seenCandidateIds: Set<string>;
}): MifDetectionOutcome {
  const { detector, context, registry, evaluationTimestamp, seenCandidateIds } = input;
  const strategyRegistry = registry.getStrategyRegistry();
  const strategy = strategyRegistry.getStrategy(detector.strategyId);

  if (detector.availabilityStatus === "DISABLED" || detector.availabilityStatus === "UNAVAILABLE") {
    return outcome({
      strategyId: detector.strategyId,
      detectorId: detector.detectorId,
      detectorVersion: detector.detectorVersion,
      status: "DETECTOR_DISABLED",
      evaluationTimestamp,
      eligibility: null,
      evidenceValidation: null,
      candidate: null,
      reasonCodes: [MIF_OD_DETECTOR_DISABLED],
      warnings: [],
      diagnostics: `detector ${detector.detectorId} status ${detector.availabilityStatus}`,
    });
  }

  if (!strategy) {
    return outcome({
      strategyId: detector.strategyId,
      detectorId: detector.detectorId,
      detectorVersion: detector.detectorVersion,
      status: "INELIGIBLE",
      evaluationTimestamp,
      eligibility: null,
      evidenceValidation: null,
      candidate: null,
      reasonCodes: [MIF_OD_INELIGIBLE],
      warnings: [],
      diagnostics: `strategy ${detector.strategyId} missing from registry`,
    });
  }

  if (
    detector.supportedSymbols
    && detector.supportedSymbols.length > 0
    && !detector.supportedSymbols.map((s) => s.toUpperCase()).includes(
      String(context.providerSymbol || "").trim().toUpperCase(),
    )
  ) {
    return outcome({
      strategyId: detector.strategyId,
      detectorId: detector.detectorId,
      detectorVersion: detector.detectorVersion,
      status: "INELIGIBLE",
      evaluationTimestamp,
      eligibility: null,
      evidenceValidation: null,
      candidate: null,
      reasonCodes: [MIF_OD_INELIGIBLE],
      warnings: [],
      diagnostics: `symbol ${context.providerSymbol} not in detector supportedSymbols`,
    });
  }

  const summary = buildStrategyEvidenceSummaryFromContext(context);
  const eligibility = strategyRegistry.evaluateEligibility(detector.strategyId, summary);
  const mapped = mapEligibilityToStatus(eligibility.status);
  if (mapped) {
    return outcome({
      strategyId: detector.strategyId,
      detectorId: detector.detectorId,
      detectorVersion: detector.detectorVersion,
      status: mapped.status,
      evaluationTimestamp,
      eligibility,
      evidenceValidation: null,
      candidate: null,
      reasonCodes: mapped.reasonCodes,
      warnings: [...eligibility.warnings],
      diagnostics: eligibility.explanation,
    });
  }

  const evidenceValidation = validateDetectorEvidence({ strategy, context });
  if (!evidenceValidation.ok) {
    const blocked = evidenceValidation.reasonCodes.includes(MIF_OD_BLOCKED_BY_DATA_QUALITY);
    return outcome({
      strategyId: detector.strategyId,
      detectorId: detector.detectorId,
      detectorVersion: detector.detectorVersion,
      status: blocked ? "BLOCKED_BY_DATA_QUALITY" : "INSUFFICIENT_EVIDENCE",
      evaluationTimestamp,
      eligibility,
      evidenceValidation,
      candidate: null,
      reasonCodes: evidenceValidation.reasonCodes.length
        ? evidenceValidation.reasonCodes
        : [MIF_OD_INSUFFICIENT_EVIDENCE],
      warnings: [...evidenceValidation.warnings],
      diagnostics: evidenceValidation.explanation,
    });
  }

  try {
    const raw = detector.evaluate(context);
    const warnings = [...(raw.warnings ?? []), ...evidenceValidation.warnings];

    if (!raw.candidate) {
      return outcome({
        strategyId: detector.strategyId,
        detectorId: detector.detectorId,
        detectorVersion: detector.detectorVersion,
        status: "NO_CANDIDATE",
        evaluationTimestamp,
        eligibility,
        evidenceValidation,
        candidate: null,
        reasonCodes: [MIF_OD_NO_CANDIDATE],
        warnings,
        diagnostics: raw.diagnostics ?? "detector returned no candidate",
      });
    }

    const candCheck = validateOpportunityCandidate(raw.candidate, {
      strategyId: detector.strategyId,
      detectorId: detector.detectorId,
    });
    if (!candCheck.ok) {
      return outcome({
        strategyId: detector.strategyId,
        detectorId: detector.detectorId,
        detectorVersion: detector.detectorVersion,
        status: "DETECTOR_ERROR",
        evaluationTimestamp,
        eligibility,
        evidenceValidation,
        candidate: null,
        reasonCodes: [MIF_OD_CANDIDATE_INVALID, MIF_OD_DETECTOR_ERROR],
        warnings,
        diagnostics: `invalid candidate: ${candCheck.errors.join("; ")}`,
      });
    }

    if (seenCandidateIds.has(raw.candidate.candidateId)) {
      return outcome({
        strategyId: detector.strategyId,
        detectorId: detector.detectorId,
        detectorVersion: detector.detectorVersion,
        status: "DETECTOR_ERROR",
        evaluationTimestamp,
        eligibility,
        evidenceValidation,
        candidate: null,
        reasonCodes: [MIF_OD_DUPLICATE_CANDIDATE_ID, MIF_OD_DETECTOR_ERROR],
        warnings,
        diagnostics: `duplicate candidateId ${raw.candidate.candidateId}`,
      });
    }
    seenCandidateIds.add(raw.candidate.candidateId);

    // Freeze candidate for immutability of returned collection
    const candidate = Object.freeze({ ...raw.candidate }) as MifOpportunityCandidate;

    return outcome({
      strategyId: detector.strategyId,
      detectorId: detector.detectorId,
      detectorVersion: detector.detectorVersion,
      status: "CANDIDATE_PRODUCED",
      evaluationTimestamp,
      eligibility,
      evidenceValidation,
      candidate,
      reasonCodes: [MIF_OD_CANDIDATE_PRODUCED],
      warnings,
      diagnostics: raw.diagnostics ?? "candidate produced",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return outcome({
      strategyId: detector.strategyId,
      detectorId: detector.detectorId,
      detectorVersion: detector.detectorVersion,
      status: "DETECTOR_ERROR",
      evaluationTimestamp,
      eligibility,
      evidenceValidation,
      candidate: null,
      reasonCodes: [MIF_OD_DETECTOR_ERROR],
      warnings: [...evidenceValidation.warnings],
      diagnostics: `detector error: ${msg}`,
    });
  }
}

export interface RunMifOpportunityDetectionInput {
  context: MifOpportunityDetectionContext;
  /** When omitted, uses default empty detector registry. */
  detectorRegistry?: MifOpportunityDetectorRegistry;
  /** Optional extra detectors for this run only (test/extension). Merged into a temp registry. */
  detectors?: readonly MifOpportunityDetector[];
  /**
   * When true (default), emit DETECTOR_NOT_REGISTERED coverage outcomes for active
   * strategies that have no registered detector.
   */
  reportMissingDetectors?: boolean;
}

export function runMifOpportunityDetection(
  input: RunMifOpportunityDetectionInput,
): MifOpportunityDetectionRunResult {
  const evaluationTimestamp = input.context?.assessmentTimestamp
    ?? "1970-01-01T00:00:00.000Z";

  const ctxCheck = validateOpportunityDetectionContext(input.context);
  if (!ctxCheck.ok) {
    return {
      contractId: MIF_OPPORTUNITY_DETECTION_CONTRACT_ID,
      contractVersion: MIF_OPPORTUNITY_DETECTION_CONTRACT_VERSION,
      engineId: MIF_OPPORTUNITY_DETECTION_ENGINE_ID,
      engineVersion: MIF_OPPORTUNITY_DETECTION_ENGINE_VERSION,
      policyId: MIF_OPPORTUNITY_DETECTION_POLICY_ID,
      policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
      assessmentTimestamp: evaluationTimestamp,
      providerSymbol: String(input.context?.providerSymbol || ""),
      outcomes: [
        outcome({
          strategyId: "*",
          detectorId: null,
          detectorVersion: null,
          status: "INVALID_CONTEXT",
          evaluationTimestamp,
          eligibility: null,
          evidenceValidation: null,
          candidate: null,
          reasonCodes: ctxCheck.reasonCodes.length
            ? (ctxCheck.reasonCodes as MifOpportunityDetectionReasonCode[])
            : [MIF_OD_INVALID_CONTEXT],
          warnings: [],
          diagnostics: ctxCheck.errors.join("; "),
        }),
      ],
      candidates: [],
      strategyCoverage: [],
      diagnosticsSummary: `invalid context: ${ctxCheck.errors.join("; ")}`,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalDetectionOnly: true,
      doesNotRankOpportunities: true,
    };
  }

  // Freeze context reference integrity — detectors must not mutate; we pass the same object
  // but do not copy deeply (assessments are treated as immutable by contract).
  const context = input.context;

  // When `detectors` is supplied without an explicit registry, run only those detectors
  // (test/isolated runs). When both are supplied, merge by detectorId (explicit overrides).
  let registry: MifOpportunityDetectorRegistry;
  if (input.detectorRegistry && input.detectors && input.detectors.length > 0) {
    const byId = new Map<string, MifOpportunityDetector>();
    for (const d of input.detectorRegistry.listDetectors()) byId.set(d.detectorId, d);
    for (const d of input.detectors) byId.set(d.detectorId, d);
    registry = createMifOpportunityDetectorRegistry(
      [...byId.values()],
      input.detectorRegistry.getStrategyRegistry(),
    );
  } else if (input.detectorRegistry) {
    registry = input.detectorRegistry;
  } else if (input.detectors && input.detectors.length > 0) {
    registry = createMifOpportunityDetectorRegistry(input.detectors);
  } else {
    registry = getDefaultMifOpportunityDetectorRegistry();
  }

  const strategyRegistry = registry.getStrategyRegistry();
  const strategies = strategyRegistry.listStrategies();
  const reportMissing = input.reportMissingDetectors !== false;

  const seenCandidateIds = new Set<string>();
  const outcomes: MifDetectionOutcome[] = [];

  // Run registered detectors in stable detectorId order
  for (const detector of registry.listDetectors()) {
    outcomes.push(
      runOneDetector({
        detector,
        context,
        registry,
        evaluationTimestamp,
        seenCandidateIds,
      }),
    );
  }

  // Coverage outcomes for strategies with no detector
  if (reportMissing) {
    for (const strategy of strategies) {
      const dets = registry.findByStrategyId(strategy.strategyId);
      if (dets.length > 0) continue;
      outcomes.push(
        outcome({
          strategyId: strategy.strategyId,
          detectorId: null,
          detectorVersion: null,
          status: "DETECTOR_NOT_REGISTERED",
          evaluationTimestamp,
          eligibility: null,
          evidenceValidation: null,
          candidate: null,
          reasonCodes: [MIF_OD_DETECTOR_NOT_REGISTERED],
          warnings: [],
          diagnostics: `strategy ${strategy.strategyId} has no registered detector`,
        }),
      );
    }
  }

  // Stable ordering: by strategyId then detectorId
  outcomes.sort((a, b) => {
    const s = String(a.strategyId).localeCompare(String(b.strategyId));
    if (s !== 0) return s;
    return String(a.detectorId ?? "").localeCompare(String(b.detectorId ?? ""));
  });

  const candidates = outcomes
    .filter((o) => o.candidate)
    .map((o) => o.candidate!)
    .sort((a, b) => a.candidateId.localeCompare(b.candidateId));

  const strategyCoverage = strategies.map((s) => {
    const dets = registry.findByStrategyId(s.strategyId);
    return {
      strategyId: s.strategyId as MifStrategyId,
      strategyActive: s.lifecycleStatus === "ACTIVE",
      detectorRegistered: dets.length > 0,
      detectorIds: dets.map((d) => d.detectorId).sort(compareStr),
    };
  });

  // Touch fingerprint to keep helper wired for future candidate builders / tests
  void fingerprintContextEvidence(context);

  const produced = outcomes.filter((o) => o.status === "CANDIDATE_PRODUCED").length;
  const errors = outcomes.filter((o) => o.status === "DETECTOR_ERROR").length;

  return {
    contractId: MIF_OPPORTUNITY_DETECTION_CONTRACT_ID,
    contractVersion: MIF_OPPORTUNITY_DETECTION_CONTRACT_VERSION,
    engineId: MIF_OPPORTUNITY_DETECTION_ENGINE_ID,
    engineVersion: MIF_OPPORTUNITY_DETECTION_ENGINE_VERSION,
    policyId: MIF_OPPORTUNITY_DETECTION_POLICY_ID,
    policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
    assessmentTimestamp: evaluationTimestamp,
    providerSymbol: String(context.providerSymbol || "").trim().toUpperCase(),
    outcomes,
    candidates,
    strategyCoverage,
    diagnosticsSummary:
      `detectors=${registry.listDetectors().length} candidates=${produced} errors=${errors} ` +
      `coverage=${strategyCoverage.filter((c) => !c.detectorRegistered).length} without detector`,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalDetectionOnly: true,
    doesNotRankOpportunities: true,
  };
}

function compareStr(a: string, b: string): number {
  return a.localeCompare(b);
}

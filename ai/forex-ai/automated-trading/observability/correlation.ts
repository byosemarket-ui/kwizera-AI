/**
 * Phase 4 — End-to-end correlation view from trusted persisted records.
 */
import {
  AT_PHASE4_OBSERVABILITY_SCHEMA,
  type AtCorrelationChain,
} from "./types.js";

export interface BuildAtCorrelationInput {
  bootId?: string | null;
  systemMasterTransitionId?: string | null;
  analysisGeneration?: number | null;
  workerRunId?: string | null;
  schedulerRunId?: string | null;
  marketSnapshotId?: string | null;
  phase2?: {
    analysisId?: string | null;
    intakeId?: string | null;
    proposalId?: string | null;
    riskDecisionId?: string | null;
    handoffId?: string | null;
    precheckId?: string | null;
    status?: string | null;
  } | null;
  phase3?: {
    analysisId?: string | null;
    intakeId?: string | null;
    proposalId?: string | null;
    riskDecisionId?: string | null;
    handoffId?: string | null;
    precheckId?: string | null;
    payloadId?: string | null;
    executionBoundaryDecisionId?: string | null;
    status?: string | null;
    boundaryStatus?: "EXECUTION_BLOCKED" | null;
    boundaryReason?: string | null;
    instrument?: string | null;
  } | null;
  instrument?: string | null;
}

export function buildAtCorrelationChain(input: BuildAtCorrelationInput): AtCorrelationChain {
  const p2 = input.phase2 ?? null;
  const p3 = input.phase3 ?? null;
  const analysisId = p3?.analysisId ?? p2?.analysisId ?? null;
  const intakeId = p3?.intakeId ?? p2?.intakeId ?? null;
  const proposalId = p3?.proposalId ?? p2?.proposalId ?? null;
  const riskDecisionId = p3?.riskDecisionId ?? p2?.riskDecisionId ?? null;
  const handoffId = p3?.handoffId ?? p2?.handoffId ?? null;
  const precheckId = p3?.precheckId ?? p2?.precheckId ?? null;

  const present = [
    input.bootId,
    analysisId,
    intakeId,
    proposalId,
    precheckId,
    p3?.payloadId,
    p3?.executionBoundaryDecisionId,
  ].filter(Boolean).length;

  return {
    schemaVersion: AT_PHASE4_OBSERVABILITY_SCHEMA,
    bootId: input.bootId ?? null,
    systemMasterTransitionId: input.systemMasterTransitionId ?? null,
    analysisGeneration:
      typeof input.analysisGeneration === "number" && Number.isFinite(input.analysisGeneration)
        ? Math.floor(input.analysisGeneration)
        : null,
    workerRunId: input.workerRunId ?? null,
    schedulerRunId: input.schedulerRunId ?? null,
    marketSnapshotId: input.marketSnapshotId ?? null,
    analysisId,
    intakeId,
    proposalId,
    riskDecisionId,
    precheckId,
    payloadId: p3?.payloadId ?? null,
    handoffId,
    executionBoundaryDecisionId: p3?.executionBoundaryDecisionId ?? null,
    phase2Status: p2?.status ?? null,
    phase3Status: p3?.status ?? null,
    boundaryStatus: p3?.boundaryStatus === "EXECUTION_BLOCKED" ? "EXECUTION_BLOCKED" : null,
    boundaryReason: p3?.boundaryReason ?? null,
    instrument: String(p3?.instrument || input.instrument || "XAU/USD"),
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note:
      present === 0
        ? "No lifecycle IDs yet — correlation fills as analysis → Phase 2 → Phase 3 progresses."
        : `Correlation linked across ${present} stage id(s). Execution remains blocked.`,
  };
}

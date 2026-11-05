import { evaluateExecutionAuthorization } from "./authorization.js";
import { getAtBrokerExecutionStore } from "./store.js";
import {
  OWNER_MAX_LOTS_EXECUTION,
  type AtBrokerExecutionPublicStatus,
} from "./types.js";
import type { AutomatedTradingEnvironment } from "../types.js";

export function getBrokerExecutionPublicStatus(input?: {
  storageRoot?: string;
  environment?: AutomatedTradingEnvironment;
  emergencyEntryLock?: boolean;
  handoffLifecycle?: string | null;
  handoffId?: string | null;
  proposalId?: string | null;
  quantityLots?: number | null;
  capitalAllocationPercent?: number | null;
  individualOrderAllocation?: number | null;
  systemMasterOn?: boolean;
}): AtBrokerExecutionPublicStatus {
  const store = getAtBrokerExecutionStore(input?.storageRoot);
  const foundation = store.get();
  const environment = input?.environment ?? "DEMO";
  const auth = evaluateExecutionAuthorization({
    foundation,
    environment,
    emergencyEntryLock: input?.emergencyEntryLock === true,
    handoffLifecycle: input?.handoffLifecycle ?? null,
    handoffId: input?.handoffId ?? foundation.activeHandoffId,
    proposalId: input?.proposalId ?? foundation.activeProposalId,
    quantityLots: input?.quantityLots ?? null,
    capitalAllocationPercent: input?.capitalAllocationPercent ?? null,
    individualOrderAllocation: input?.individualOrderAllocation ?? null,
    systemMasterOn: input?.systemMasterOn === true,
  });

  const blockers = [
    ...foundation.blockers,
    ...auth.blockers.filter((b) => !foundation.blockers.some((f) => f.code === b.code)),
  ];

  return {
    schemaVersion: foundation.schemaVersion,
    phase: foundation.phase,
    stateVersion: foundation.stateVersion,
    executionMasterEnabled: false,
    armedForSubmission: false,
    lifecycle: foundation.lifecycle,
    environmentBound: foundation.environmentBound,
    activeHandoffId: foundation.activeHandoffId,
    activeProposalId: foundation.activeProposalId,
    activeAuthorizationId: foundation.activeAuthorizationId,
    blockers,
    authorizationIntentCount: foundation.authorizationIntents.length,
    auditCount: foundation.audit.length,
    ownerMaxLots: OWNER_MAX_LOTS_EXECUTION,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    brokerExecution: "DISABLED",
    executionStatusLabel: "EXECUTION_FORBIDDEN",
    systemMasterDoesNotAuthorizeExecution: true,
    handoffReadyIsNotExecutionPermission: true,
    phase1SubmitImplemented: false,
    phaseNote: foundation.phaseNote,
    prerequisites: {
      capitalAllocationConfigured:
        input?.capitalAllocationPercent != null
        && Number.isFinite(input.capitalAllocationPercent)
        && input?.individualOrderAllocation != null
        && Number.isFinite(input.individualOrderAllocation)
        && (input.individualOrderAllocation as number) > 0
          ? true
          : (input?.capitalAllocationPercent === undefined
            && input?.individualOrderAllocation === undefined
            ? null
            : false),
      compatibleInstrumentAtOwnerMax: null,
      eligibleBuySellSignal: null,
      demoMutationGates: "NOT_EVALUATED_PHASE1",
    },
  };
}

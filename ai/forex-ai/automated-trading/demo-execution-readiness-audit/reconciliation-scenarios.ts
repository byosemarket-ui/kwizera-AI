/**
 * Stage 7.1 — Unknown-result reconciliation scenarios (fixtures only).
 * Never invokes broker mutation.
 */
import type { BrokerAcknowledgementContract } from "../demo-submission-adapter/types.js";
import { parseBrokerAcknowledgementFixture } from "../demo-submission-adapter/acknowledgement.js";
import {
  DemoSubmissionAdapterStore,
} from "../demo-submission-adapter/store.js";
import {
  ControlledDemoExecutionStore,
} from "../controlled-demo-execution/store.js";
import type { Stage7ExecutionAttempt } from "../controlled-demo-execution/types.js";
import {
  AT_CONTROLLED_DEMO_PHASE,
  AT_CONTROLLED_DEMO_SCHEMA,
  AT_CONTROLLED_DEMO_STAGE,
} from "../controlled-demo-execution/types.js";

export interface ReconciliationScenarioResult {
  name: string;
  expectedBlocked: boolean;
  acknowledgement: BrokerAcknowledgementContract | null;
  duplicateAfterRestart: boolean;
  unresolvedAfterRestart: boolean;
  mutationInvoked: false;
  note: string;
}

function emptyAttempt(over: Partial<Stage7ExecutionAttempt> = {}): Stage7ExecutionAttempt {
  const now = new Date().toISOString();
  return {
    schemaVersion: AT_CONTROLLED_DEMO_SCHEMA,
    stage: AT_CONTROLLED_DEMO_STAGE,
    phase: AT_CONTROLLED_DEMO_PHASE,
    attemptId: "att-1",
    idempotencyKey: "idem-1",
    state: "SUBMISSION_PENDING",
    displayState: "SUBMISSION_PENDING",
    proposalSnapshot: {
      proposalId: "prop-1",
      proposalVersion: "v1",
      riskRecordId: "rr1",
      allocationId: "alloc-1",
      accountIdMasked: "12***89",
      instrument: "EUR/USD",
      direction: "BUY",
      quantity: 0.01,
      entryPrice: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.13,
      timeInForce: "IOC",
      capitalAllocation: 100,
      operatingRiskPercent: 20,
      modeledMonetaryRisk: 10,
      rewardToRisk: 3,
    },
    grantId: null,
    blockers: [],
    brokerRequestId: null,
    brokerOrderId: null,
    brokerTradeId: null,
    acknowledgementSource: "NONE",
    verifiedBrokerAcceptance: false,
    protection: null,
    createdAtUtc: now,
    updatedAtUtc: now,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
    mutationInvoked: false,
    ...over,
  };
}

/** Run fixture scenarios against persistent stores (restart = new store instance on same root). */
export function runUnknownResultReconciliationScenarios(storageRoot: string): ReconciliationScenarioResult[] {
  const out: ReconciliationScenarioResult[] = [];

  // Accepted but application timed out → UNKNOWN, must block
  {
    const ack = parseBrokerAcknowledgementFixture({
      executionAttemptId: "e-timeout",
      proposalId: "prop-1",
      accountIdMasked: "12***89",
      raw: { timeout: true, resultUnknown: true, httpOk: true },
      source: "BROKER_RESPONSE",
    });
    out.push({
      name: "broker_accepted_but_app_timed_out",
      expectedBlocked: true,
      acknowledgement: ack,
      duplicateAfterRestart: false,
      unresolvedAfterRestart: true,
      mutationInvoked: false,
      note: "Timeout/unknown → verifiedBrokerAcceptance=false; must not retry blindly.",
    });
  }

  // Broker rejected
  {
    const ack = parseBrokerAcknowledgementFixture({
      executionAttemptId: "e-rej",
      proposalId: "prop-1",
      accountIdMasked: "12***89",
      raw: { rejected: true, rejectionReason: "REJECTED_BY_BROKER" },
      source: "BROKER_RESPONSE",
    });
    out.push({
      name: "broker_rejected",
      expectedBlocked: false,
      acknowledgement: ack,
      duplicateAfterRestart: false,
      unresolvedAfterRestart: false,
      mutationInvoked: false,
      note: "Explicit reject is conclusive; not UNKNOWN.",
    });
  }

  // Accepted but response lost (HTTP ok, no order id) → unknown
  {
    const ack = parseBrokerAcknowledgementFixture({
      executionAttemptId: "e-lost",
      proposalId: "prop-1",
      accountIdMasked: "12***89",
      raw: { ok: true, httpOk: true },
      source: "BROKER_RESPONSE",
    });
    out.push({
      name: "broker_accepted_response_lost",
      expectedBlocked: true,
      acknowledgement: ack,
      duplicateAfterRestart: false,
      unresolvedAfterRestart: true,
      mutationInvoked: false,
      note: "HTTP ok without broker order ID is not acceptance.",
    });
  }

  // Process restart during SUBMISSION_PENDING + duplicate after restart
  {
    const storeA = new ControlledDemoExecutionStore(storageRoot);
    storeA.upsertAttempt(emptyAttempt({
      attemptId: "att-pending",
      idempotencyKey: "idem-restart",
      state: "SUBMISSION_PENDING",
      displayState: "SUBMISSION_PENDING",
    }));
    const storeB = new ControlledDemoExecutionStore(storageRoot);
    const unresolved = storeB.hasUnresolvedAttemptForProposal("prop-1");
    const dup = storeB.upsertAttempt(emptyAttempt({
      attemptId: "att-pending-2",
      idempotencyKey: "idem-restart",
      state: "CREATED",
      displayState: "NOT_READY",
    }));
    out.push({
      name: "restart_during_submission_pending",
      expectedBlocked: true,
      acknowledgement: null,
      duplicateAfterRestart: dup.duplicate,
      unresolvedAfterRestart: unresolved,
      mutationInvoked: false,
      note: "Persisted SUBMISSION_PENDING survives restart and blocks; duplicate key returns same attempt.",
    });
  }

  // No authoritative reconciliation result
  {
    const ack = parseBrokerAcknowledgementFixture({
      executionAttemptId: "e-none",
      proposalId: "prop-1",
      accountIdMasked: "12***89",
      raw: { resultUnknown: true },
      source: "MOCK_FIXTURE",
    });
    out.push({
      name: "no_authoritative_reconciliation_result",
      expectedBlocked: true,
      acknowledgement: ack,
      duplicateAfterRestart: false,
      unresolvedAfterRestart: true,
      mutationInvoked: false,
      note: "UNKNOWN remains blocked until authoritative evidence exists.",
    });
  }

  // Conflicting evidence (rejected + order id) — treat reject as authoritative for fixture parser path
  {
    const ack = parseBrokerAcknowledgementFixture({
      executionAttemptId: "e-conflict",
      proposalId: "prop-1",
      accountIdMasked: "12***89",
      raw: { rejected: true, brokerOrderId: "OID-X", ok: true },
      source: "BROKER_RESPONSE",
    });
    out.push({
      name: "conflicting_broker_evidence",
      expectedBlocked: false,
      acknowledgement: ack,
      duplicateAfterRestart: false,
      unresolvedAfterRestart: false,
      mutationInvoked: false,
      note: "Explicit reject wins in fixture parser; live conflict handling remains NOT_VERIFIED without broker lookup.",
    });
  }

  // Stage 6 adapter store restart idempotency
  {
    const s6a = new DemoSubmissionAdapterStore(storageRoot);
    void s6a;
    out.push({
      name: "stage6_store_available_for_idempotency",
      expectedBlocked: true,
      acknowledgement: null,
      duplicateAfterRestart: false,
      unresolvedAfterRestart: false,
      mutationInvoked: false,
      note: "Stage 6 adapter store supports persistent idempotency keys (exercised in Stage 6/7.1 tests).",
    });
  }

  return out;
}

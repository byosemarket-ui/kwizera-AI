/**
 * Step 3 — Orchestrate handoff validation + persistence.
 */
import type { AtOrderProposalRecord } from "../order-proposal/types.js";
import { buildBrokerHandoff, toFutureExecutionContract } from "./engine.js";
import { getAtBrokerHandoffStore } from "./store.js";
import {
  AT_BROKER_HANDOFF_PHASE,
  AT_BROKER_HANDOFF_SCHEMA,
  type AtBrokerCompatibilityInput,
  type AtBrokerHandoffPublicStatus,
  type AtBrokerHandoffRecord,
  type AtFutureExecutionContract,
} from "./types.js";

export function getBrokerHandoffPublicStatus(
  storageRoot?: string,
): AtBrokerHandoffPublicStatus {
  const store = getAtBrokerHandoffStore(storageRoot);
  return {
    schemaVersion: AT_BROKER_HANDOFF_SCHEMA,
    phase: AT_BROKER_HANDOFF_PHASE,
    latest: store.latest(),
    historyCount: store.list(80).length,
    readyCount: store.countReady(),
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note:
      "BROKER VALIDATION / HANDOFF stage only. Never places broker orders. "
      + "HANDOFF_READY means validation passed — not that FXCM accepted an order.",
  };
}

export function validateProposalForBrokerHandoff(
  input: AtBrokerCompatibilityInput,
  opts?: { persist?: boolean; storageRoot?: string },
): {
  record: AtBrokerHandoffRecord;
  duplicate: boolean;
  futureContract: AtFutureExecutionContract;
} {
  const built = buildBrokerHandoff(input);
  const persist = opts?.persist !== false;
  if (!persist) {
    return {
      record: built,
      duplicate: false,
      futureContract: toFutureExecutionContract(built),
    };
  }
  const store = getAtBrokerHandoffStore(opts?.storageRoot);
  const { record, duplicate } = store.upsertHandoff(built);
  return {
    record,
    duplicate,
    futureContract: toFutureExecutionContract(record),
  };
}

export function requireProposalReady(
  proposal: AtOrderProposalRecord | null | undefined,
): { ok: true } | { ok: false; code: string; message: string } {
  if (!proposal) {
    return { ok: false, code: "PROPOSAL_MISSING", message: "Order proposal is required." };
  }
  if (proposal.lifecycle !== "PROPOSAL_READY") {
    return {
      ok: false,
      code: "PROPOSAL_NOT_READY",
      message: `Proposal lifecycle ${proposal.lifecycle} is not PROPOSAL_READY.`,
    };
  }
  return { ok: true };
}

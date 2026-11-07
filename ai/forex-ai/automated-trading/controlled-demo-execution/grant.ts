/**
 * Stage 7 — One-time owner execution grant (server-generated).
 * Bound to exact proposal snapshot. activatesMutation always false in Stage 7.
 */
import { randomUUID } from "node:crypto";
import type { Stage7ExecutionGrant, Stage7ProposalSnapshot, Stage7ReadinessReport } from "./types.js";
import {
  AT_CONTROLLED_DEMO_SCHEMA,
  AT_CONTROLLED_DEMO_STAGE,
  type Stage7SupportedTif,
} from "./types.js";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export interface IssueGrantInput {
  readiness: Stage7ReadinessReport;
  actor: string;
  /** Must be true — echoes owner confirmation of full order details. */
  confirm: boolean;
  /** Owner-echoed fields must match readiness snapshot exactly. */
  confirmed: {
    proposalId: string;
    proposalVersion: string;
    instrument: string;
    direction: "BUY" | "SELL";
    quantity: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    timeInForce: Stage7SupportedTif;
    accountIdMasked: string;
  };
  ttlMs?: number;
  nowMs?: number;
}

export type IssueGrantResult =
  | { ok: true; grant: Stage7ExecutionGrant }
  | { ok: false; code: string; message: string };

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-8;
}

/**
 * Issue a short-lived one-time grant.
 * Requires technicalPass (READY_FOR_OWNER_REVIEW or better) AND confirm=true AND exact field echo.
 * Does NOT require Execution Master ON to issue a review grant — but submission still blocked.
 * Spec: authorization bound to exact values; Stage 7 activatesMutation=false always.
 */
export function issueControlledDemoGrant(input: IssueGrantInput): IssueGrantResult {
  if (input.confirm !== true) {
    return {
      ok: false,
      code: "CONFIRMATION_REQUIRED",
      message: "Explicit confirm=true required with complete order details acknowledgment.",
    };
  }
  const snap = input.readiness.snapshot;
  if (!snap || !input.readiness.technicalPass) {
    return {
      ok: false,
      code: "NOT_READY_FOR_GRANT",
      message: "Technical readiness gates must PASS before a grant can be issued.",
    };
  }
  if (!snap.riskRecordId || !snap.allocationId || !snap.instrument || !snap.direction) {
    return { ok: false, code: "SNAPSHOT_INCOMPLETE", message: "Proposal snapshot incomplete for grant binding." };
  }
  if (snap.quantity == null || snap.entryPrice == null || snap.stopLoss == null || snap.takeProfit == null) {
    return { ok: false, code: "SNAPSHOT_PRICES_INCOMPLETE", message: "Entry/SL/TP/quantity required on snapshot." };
  }
  if (!snap.timeInForce) {
    return { ok: false, code: "TIF_REQUIRED", message: "Verified Time In Force required on snapshot." };
  }
  if (!snap.accountIdMasked) {
    return { ok: false, code: "ACCOUNT_IDENTITY_MISSING", message: "Account identity required for grant." };
  }

  const c = input.confirmed;
  if (c.proposalId !== snap.proposalId) {
    return { ok: false, code: "CONFIRM_PROPOSAL_MISMATCH", message: "Confirmed proposalId does not match snapshot." };
  }
  if (c.proposalVersion !== snap.proposalVersion) {
    return { ok: false, code: "CONFIRM_VERSION_MISMATCH", message: "Confirmed proposalVersion does not match snapshot." };
  }
  if (c.instrument !== snap.instrument || c.direction !== snap.direction) {
    return { ok: false, code: "CONFIRM_INSTRUMENT_MISMATCH", message: "Confirmed instrument/direction mismatch." };
  }
  if (!near(c.quantity, snap.quantity) || !near(c.entryPrice, snap.entryPrice)
    || !near(c.stopLoss, snap.stopLoss) || !near(c.takeProfit, snap.takeProfit)) {
    return { ok: false, code: "CONFIRM_LEVELS_MISMATCH", message: "Confirmed quantity/prices do not match snapshot." };
  }
  if (c.timeInForce !== snap.timeInForce) {
    return { ok: false, code: "CONFIRM_TIF_MISMATCH", message: "Confirmed Time In Force mismatch." };
  }
  if (c.accountIdMasked !== snap.accountIdMasked) {
    return { ok: false, code: "CONFIRM_ACCOUNT_MISMATCH", message: "Confirmed account identity mismatch." };
  }

  const nowMs = input.nowMs ?? Date.now();
  const ttl = Math.max(30_000, Math.min(input.ttlMs ?? DEFAULT_TTL_MS, 15 * 60 * 1000));
  const grantId = randomUUID();
  const snapshot: Stage7ProposalSnapshot = { ...snap };

  const grant: Stage7ExecutionGrant = {
    grantId,
    schemaVersion: AT_CONTROLLED_DEMO_SCHEMA,
    stage: AT_CONTROLLED_DEMO_STAGE,
    createdAtUtc: new Date(nowMs).toISOString(),
    expiresAtUtc: new Date(nowMs + ttl).toISOString(),
    createdBy: String(input.actor || "forex-admin").trim() || "forex-admin",
    proposalId: snap.proposalId,
    proposalVersion: snap.proposalVersion,
    riskRecordId: snap.riskRecordId,
    allocationId: snap.allocationId,
    accountIdMasked: snap.accountIdMasked,
    environment: "DEMO",
    instrument: snap.instrument,
    direction: snap.direction,
    quantity: snap.quantity,
    entryPrice: snap.entryPrice,
    stopLoss: snap.stopLoss,
    takeProfit: snap.takeProfit,
    timeInForce: snap.timeInForce,
    idempotencyKey: `grant:${snap.proposalId}:${snap.proposalVersion}:${grantId}`,
    snapshot,
    usedAtUtc: null,
    revokedAtUtc: null,
    activatesMutation: false,
    confirmAcknowledged: true,
    note:
      "Stage 7 one-time grant — activatesMutation=false. "
      + "Does not authorize ForexConnect create_order_request/send_request. "
      + "requireForexAdmin is the owner authorization boundary for issuance.",
  };

  return { ok: true, grant };
}

export function revokeGrant(grant: Stage7ExecutionGrant, nowMs?: number): Stage7ExecutionGrant {
  return {
    ...grant,
    revokedAtUtc: new Date(nowMs ?? Date.now()).toISOString(),
  };
}

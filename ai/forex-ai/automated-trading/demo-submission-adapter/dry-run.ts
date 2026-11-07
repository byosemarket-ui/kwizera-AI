/**
 * Stage 6 — Non-submitting dry-run orchestration.
 * Constructs FXCM payload, validates integrity/auth/DEMO, never invokes mutation port.
 */
import { randomUUID } from "node:crypto";
import type { AtOrderProposalRecord } from "../order-proposal/types.js";
import type { AutomatedTradingEnvironment } from "../types.js";
import { buildDryRunAcknowledgement } from "./acknowledgement.js";
import { evaluateAuthorizationRequirements, type PerSubmissionAuthorizationGrant } from "./authorization.js";
import { verifyDemoEnvironment } from "./demo-environment.js";
import { buildFxcmTrueMarketOpenPayload, redactFxcmPayloadForAudit } from "./fxcm-payload.js";
import {
  AssertNeverCalledMutationPort,
  getDefaultMutationPort,
  type NoopMutationPort,
} from "./mutation-port.js";
import { evaluateStage5ProposalIntegrity } from "./proposal-integrity.js";
import { getDemoSubmissionAdapterStore } from "./store.js";
import {
  AT_DEMO_ADAPTER_PHASE,
  AT_DEMO_ADAPTER_SCHEMA,
  AT_DEMO_ADAPTER_STAGE,
  DEMO_ADAPTER_SUBMISSION_MODE,
  type BrokerMutationPort,
  type DemoAdapterAttemptRecord,
  type DemoAdapterPublicStatus,
  type DemoAdapterReadinessCategory,
} from "./types.js";
import {
  DEMO_ADAPTER_MIN_REWARD_TO_RISK,
  DEMO_ADAPTER_OWNER_MAX_LOTS,
  DEMO_ADAPTER_RISK_MAX_PERCENT,
  DEMO_ADAPTER_RISK_TARGET_PERCENT,
} from "./types.js";

export interface DryRunAdapterInput {
  proposal: AtOrderProposalRecord | null;
  expectedProposalId?: string | null;
  configuredEnvironment: AutomatedTradingEnvironment;
  sessionEnvironment: string | null;
  accountEnvironment?: string | null;
  accountIdMasked: string | null;
  expectedAccountIdMasked?: string | null;
  sessionStatus?: string | null;
  offerId?: string | null;
  baseUnitSize?: number | null;
  bid?: number | null;
  ask?: number | null;
  handoffId?: string | null;
  handoffProposalId?: string | null;
  executionMasterEnabled?: boolean;
  emergencyEntryLock?: boolean;
  tradingEnabled?: boolean;
  /** Optional synthetic final-precheck pass flag (Stage 6 never treats as submission auth). */
  freshFinalPrecheckPass?: boolean;
  perSubmissionGrant?: PerSubmissionAuthorizationGrant | null;
  idempotencyKey?: string | null;
  mutationPort?: BrokerMutationPort;
  persist?: boolean;
  storageRoot?: string;
  nowMs?: number;
  clientClaimedEnvironment?: string | null;
}

export interface DryRunAdapterResult {
  ok: boolean;
  duplicate: boolean;
  attempt: DemoAdapterAttemptRecord;
  readinessCategory: DemoAdapterReadinessCategory;
  fxcmPayloadAudit: Record<string, unknown> | null;
  mutationInvoked: false;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  executionAuthorized: false;
  note: string;
}

function resolveReadiness(input: {
  blockers: Array<{ code: string }>;
  demoOk: boolean;
  authMissing: string[];
  payloadOk: boolean;
}): DemoAdapterReadinessCategory {
  const codes = new Set(input.blockers.map((b) => b.code));
  if (codes.has("PROPOSAL_MISSING") || codes.has("WAITING_FOR_PROPOSAL")) {
    return "WAITING_FOR_PROPOSAL";
  }
  if (!input.demoOk || codes.has("LIVE_ENVIRONMENT_FORBIDDEN") || codes.has("DEMO_ENVIRONMENT_NOT_VERIFIED")) {
    return "DEMO_NOT_VERIFIED";
  }
  if (codes.has("PROPOSAL_EXPIRED") || codes.has("PROPOSAL_NOT_READY") || codes.has("RISK_VALIDATION_FAILED")) {
    return "PROPOSAL_INVALID";
  }
  if (!input.payloadOk) return "PRECHECK_BLOCKED";
  if (input.authMissing.length > 0) return "AUTHORIZATION_REQUIRED";
  return "DRY_RUN_COMPLETED";
}

/**
 * Run Stage 6 dry-run. Guarantees mutation port is never successfully invoked.
 */
export function runDemoAdapterDryRun(input: DryRunAdapterInput): DryRunAdapterResult {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const executionAttemptId = randomUUID();
  const proposalId = input.proposal?.proposalId
    ?? input.expectedProposalId
    ?? "missing";
  const idempotencyKey = String(input.idempotencyKey || "").trim()
    || `dryrun:${proposalId}:${input.accountIdMasked ?? "na"}`;

  const store = getDemoSubmissionAdapterStore(input.storageRoot);
  const existing = store.getByIdempotencyKey(idempotencyKey);
  if (existing && input.persist !== false) {
    return {
      ok: existing.state === "DRY_RUN_RECORDED" || existing.state === "PREPARED",
      duplicate: true,
      attempt: existing,
      readinessCategory: existing.readinessCategory,
      fxcmPayloadAudit: existing.payload
        ? {
          orderTypeConstant: existing.payload.orderTypeConstant,
          buySell: existing.payload.buySell,
          amount: existing.payload.amount,
          lots: existing.payload.lots,
          symbol: existing.payload.symbol,
        }
        : null,
      mutationInvoked: false,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      executionAuthorized: false,
      note: "Idempotent replay — existing dry-run attempt returned; no mutation.",
    };
  }

  const blockers: Array<{ code: string; message: string }> = [];

  // Hard Stage 6 mode gate
  blockers.push({
    code: "STAGE_6_SUBMISSION_DISABLED",
    message: "Stage 6 submission mode is DISABLED — dry-run only; ForexConnect mutation not invoked.",
  });

  const env = verifyDemoEnvironment({
    configuredEnvironment: input.configuredEnvironment,
    sessionEnvironment: input.sessionEnvironment,
    accountEnvironment: input.accountEnvironment,
    accountIdMasked: input.accountIdMasked,
    expectedAccountIdMasked: input.expectedAccountIdMasked,
    sessionStatus: input.sessionStatus,
    clientClaimedEnvironment: input.clientClaimedEnvironment,
  });
  if (!env.ok) {
    blockers.push({ code: env.code, message: env.message });
  }

  const integrity = evaluateStage5ProposalIntegrity({
    proposal: input.proposal,
    expectedProposalId: input.expectedProposalId,
    expectedAccountIdMasked: input.expectedAccountIdMasked ?? input.accountIdMasked,
    expectedHandoffId: input.handoffId,
    handoffProposalId: input.handoffProposalId,
    nowMs,
  });
  blockers.push(...integrity.blockers);

  let payload: import("./types.js").FxcmTrueMarketOpenPayload | null = null;
  let payloadOk = false;
  if (input.proposal && env.ok) {
    const acct = String(
      input.proposal.brokerPrep.accountReference
      || input.accountIdMasked
      || "",
    ).trim();
    const built = buildFxcmTrueMarketOpenPayload({
      proposal: input.proposal,
      accountId: acct,
      offerId: input.offerId,
      symbol: input.proposal.instrument,
      baseUnitSize: input.baseUnitSize ?? input.proposal.quantity.contractSize,
      bid: input.bid,
      ask: input.ask,
    });
    if (!built.ok) {
      blockers.push({ code: built.code, message: built.message });
    } else {
      payload = built.payload;
      payloadOk = true;
    }
  }

  const auth = evaluateAuthorizationRequirements({
    executionMasterEnabled: input.executionMasterEnabled === true,
    emergencyEntryLock: input.emergencyEntryLock !== false, // default ON if unspecified
    tradingEnabled: input.tradingEnabled === true,
    freshFinalPrecheckPass: input.freshFinalPrecheckPass === true,
    demoEnvironmentVerified: env.positivelyVerifiedDemo,
    perSubmissionGrant: input.perSubmissionGrant ?? null,
    proposalId,
    proposalVersion: integrity.proposalVersion ?? "unknown",
    accountIdMasked: input.accountIdMasked,
    priorSuccessfulSubmission: store.hasSuccessfulSubmissionForProposal(proposalId),
    nowMs,
  });
  for (const m of auth.missing) {
    if (!blockers.some((b) => b.code === m)) {
      blockers.push({ code: m, message: `Authorization requirement not met: ${m}` });
    }
  }

  const readinessCategory = resolveReadiness({
    blockers,
    demoOk: env.positivelyVerifiedDemo,
    authMissing: auth.missing,
    payloadOk,
  });

  // Critical: mutation port must never be called.
  const port = input.mutationPort ?? getDefaultMutationPort();
  let mutationInvoked = false as const;
  try {
    // Deliberately do not await/call invokeTrueMarketOpen.
    void port.name;
  } catch {
    /* unreachable */
  }

  const acknowledgement = buildDryRunAcknowledgement({
    executionAttemptId,
    proposalId,
    accountIdMasked: input.accountIdMasked,
  });

  const attempt: DemoAdapterAttemptRecord = {
    schemaVersion: AT_DEMO_ADAPTER_SCHEMA,
    stage: AT_DEMO_ADAPTER_STAGE,
    phase: AT_DEMO_ADAPTER_PHASE,
    executionAttemptId,
    idempotencyKey,
    proposalId,
    proposalVersion: integrity.proposalVersion,
    allocationId: integrity.allocationId,
    handoffId: input.handoffId ?? null,
    accountIdMasked: input.accountIdMasked,
    instrument: input.proposal?.instrument ?? null,
    direction: input.proposal?.direction ?? null,
    state: payloadOk ? "DRY_RUN_RECORDED" : "SUBMISSION_BLOCKED",
    readinessCategory,
    submissionMode: DEMO_ADAPTER_SUBMISSION_MODE,
    payload,
    environment: env,
    authorization: auth,
    blockers,
    acknowledgement,
    createdAtUtc: nowIso,
    updatedAtUtc: nowIso,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
    mutationInvoked: false,
  };

  let duplicate = false;
  let saved = attempt;
  if (input.persist !== false) {
    const up = store.upsertAttempt(attempt);
    saved = up.record;
    duplicate = up.duplicate;
  }

  return {
    ok: payloadOk && env.ok,
    duplicate,
    attempt: saved,
    readinessCategory: saved.readinessCategory,
    fxcmPayloadAudit: payload ? redactFxcmPayloadForAudit(payload) : null,
    mutationInvoked,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
    note:
      "Stage 6 dry-run: FXCM payload constructed and validated when possible. "
      + "Submission mode DISABLED. Mutation port not invoked. "
      + "verifiedBrokerAcceptance=false.",
  };
}

export function getDemoAdapterPublicStatus(storageRoot?: string): DemoAdapterPublicStatus {
  const store = getDemoSubmissionAdapterStore(storageRoot);
  const latest = store.latest();
  return {
    schemaVersion: AT_DEMO_ADAPTER_SCHEMA,
    stage: AT_DEMO_ADAPTER_STAGE,
    phase: AT_DEMO_ADAPTER_PHASE,
    submissionMode: DEMO_ADAPTER_SUBMISSION_MODE,
    readinessCategory: latest?.readinessCategory ?? "ADAPTER_DISABLED",
    ownerMaxLots: DEMO_ADAPTER_OWNER_MAX_LOTS,
    riskTargetPercent: DEMO_ADAPTER_RISK_TARGET_PERCENT,
    riskMaximumPercent: DEMO_ADAPTER_RISK_MAX_PERCENT,
    minimumRewardToRisk: DEMO_ADAPTER_MIN_REWARD_TO_RISK,
    latestAttempt: latest,
    attemptCount: store.list(80).length,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
    brokerSubmissionImplemented: false,
    mutationPortWired: false,
    note:
      "Stage 6 FXCM DEMO adapter boundary — DISABLED / dry-run only. "
      + "Existing demo-lifecycle mutation routes are separate and remain grant-gated. "
      + "This adapter does not call ForexConnect create_order_request/send_request.",
  };
}

/** Test helper: prove AssertNeverCalledMutationPort stays empty after dry-run. */
export function createAssertNeverCalledPort(): AssertNeverCalledMutationPort {
  return new AssertNeverCalledMutationPort();
}

export type { NoopMutationPort };

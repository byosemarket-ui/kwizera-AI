/**
 * Phase 4.3 — Bridge prepared DEMO entry → grant-scoped openMarket.
 * Submits ONLY when every activation gate passes.
 * Keeps global placesOrders / acceptsForExecution / LIVE false.
 */
import { randomUUID } from "node:crypto";
import type { PrepareAutoEntryResult } from "./prepare-entry.js";
import type { DailyRiskSnapshot } from "../daily-risk/types.js";
import { PROPOSED_BOUNDED_DEMO_ACTIVATION } from "../../demo-execution/demo-activation-config.js";
import type { DemoLifecycleOrchestrator } from "../../demo-execution/orchestrator.js";
import { getDemoExecutionGrantStore } from "../../demo-execution/grant-store.js";

export interface SubmitPreparedEntryInput {
  prepared: PrepareAutoEntryResult;
  dailyRisk: DailyRiskSnapshot | null;
  grantId: string;
  allowDemoMutationEnabled: boolean;
  /** Must be false (unlocked) before DEMO submit. */
  emergencyEntryLock: boolean;
  masterEnable: boolean;
  reconcileBlockNewEntries: boolean;
  /** Explicit owner activation — prevents accidental submits from dry_run ticks. */
  submitAuthorized: boolean;
  accountId?: string | null;
  orchestrator: Pick<DemoLifecycleOrchestrator, "openMarket">;
  nowMs?: number;
}

export interface SubmitPreparedEntryResult {
  ok: boolean;
  code: string;
  blockers: string[];
  submitted: boolean;
  mutatesBroker: boolean;
  placesOrders: false;
  acceptsForExecution: false;
  liveUnauthorized: true;
  lifecycleId: string | null;
  brokerOrderId: string | null;
  tradeId: string | null;
  fillConfirmed: boolean | null;
  idempotencyKey: string | null;
  note: string;
}

/**
 * Fail-closed DEMO submit. Never enables LIVE or global AT placesOrders.
 */
export async function submitPreparedDemoEntry(
  input: SubmitPreparedEntryInput,
): Promise<SubmitPreparedEntryResult> {
  const blockers: string[] = [];
  const deny = (code: string, extra: string[] = []): SubmitPreparedEntryResult => ({
    ok: false,
    code,
    blockers: [...extra, ...blockers],
    submitted: false,
    mutatesBroker: false,
    placesOrders: false,
    acceptsForExecution: false,
    liveUnauthorized: true,
    lifecycleId: null,
    brokerOrderId: null,
    tradeId: null,
    fillConfirmed: null,
    idempotencyKey: null,
    note: "DEMO submit blocked. No broker mutation attempted.",
  });

  if (!input.submitAuthorized) {
    return deny("SUBMIT_NOT_AUTHORIZED");
  }
  if (input.masterEnable === true) {
    return deny("MASTER_ENABLE_MUST_REMAIN_FALSE");
  }
  if (input.emergencyEntryLock === true) {
    return deny("EMERGENCY_ENTRY_LOCK_ACTIVE");
  }
  if (!input.allowDemoMutationEnabled) {
    return deny("DEMO_MUTATION_FLAG_DISABLED");
  }
  if (input.reconcileBlockNewEntries) {
    return deny("RECONCILE_BLOCKS_ENTRIES");
  }
  if (!input.dailyRisk?.authoritative) {
    return deny("DAY_RISK_TELEMETRY_NOT_AUTHORITATIVE", input.dailyRisk?.blockers ?? []);
  }
  if (!input.prepared.ok || !input.prepared.prepared) {
    return deny(input.prepared.code || "ENTRY_NOT_PREPARED", input.prepared.blockers);
  }

  const prepared = input.prepared.prepared;
  const allow = PROPOSED_BOUNDED_DEMO_ACTIVATION.permittedInstruments.map((s) =>
    s.replace(/\s+/g, "").toUpperCase()
  );
  const sym = prepared.instrument.replace(/\s+/g, "").toUpperCase();
  if (!allow.includes(sym)) {
    return deny("INSTRUMENT_NOT_ALLOWLISTED");
  }
  if (!(prepared.lots > 0) || prepared.lots > PROPOSED_BOUNDED_DEMO_ACTIVATION.maxLotsPerOrder) {
    return deny("LOTS_OUT_OF_BOUNDS");
  }

  const grantCheck = getDemoExecutionGrantStore().requireActive(
    input.grantId,
    prepared.instrument,
    prepared.lots,
  );
  if (!grantCheck.ok) {
    return deny(grantCheck.code, [grantCheck.error ?? "GRANT_INVALID"]);
  }

  const idempotencyKey = `auto-engine:${input.prepared.signalId}:${prepared.direction}:${prepared.lots}`;
  const result = await input.orchestrator.openMarket({
    grantId: input.grantId,
    instrument: prepared.instrument,
    direction: prepared.direction,
    lots: prepared.lots,
    stopLoss: prepared.stopLoss,
    takeProfit: prepared.takeProfit,
    entryHint: prepared.entryPrice,
    requireProtective: true,
    idempotencyKey,
    accountId: input.accountId ?? undefined,
    sourceDecisionId: input.prepared.signalId,
  });

  return {
    ok: result.ok && result.record.fillConfirmed === true,
    code: result.code,
    blockers: result.ok ? [] : [result.code, result.error ?? ""].filter(Boolean),
    submitted: result.record.mutatesBroker === true || Boolean(result.record.brokerOrderId),
    mutatesBroker: result.record.mutatesBroker === true,
    placesOrders: false,
    acceptsForExecution: false,
    liveUnauthorized: true,
    lifecycleId: result.record.lifecycleId,
    brokerOrderId: result.record.brokerOrderId,
    tradeId: result.record.tradeId,
    fillConfirmed: result.record.fillConfirmed,
    idempotencyKey,
    note: result.ok
      ? (result.record.fillConfirmed
        ? "DEMO openMarket acknowledged with fill confirmation."
        : "DEMO openMarket returned without confirmed fill — treat as uncertain; do not resubmit blindly.")
      : "DEMO openMarket rejected or failed closed.",
  };
}

/** Deterministic idempotency helper for tests. */
export function buildAutoEngineIdempotencyKey(signalId: string, direction: string, lots: number): string {
  return `auto-engine:${signalId || randomUUID()}:${direction}:${lots}`;
}

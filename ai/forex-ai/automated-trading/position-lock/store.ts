/**
 * Persistent, concurrency-safe XAU/USD single-position lock.
 *
 * Every decision re-reads the file under a cross-process mutex (no in-memory authority), so
 * concurrent workers, duplicate requests, restarts and multiple app instances see one lock.
 * Release requires read-only broker evidence; timers, UI state, AI predictions, worker stops
 * and disconnections never release it. Never mutates the broker.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { withFileMutex } from "./file-mutex.js";
import {
  XAU_POSITION_LOCK_INSTRUMENT,
  XAU_POSITION_LOCK_SCHEMA,
  type XauBrokerEvidence,
  type XauLockBlockCode,
  type XauLockEvent,
  type XauLockState,
  type XauPositionLockRecord,
} from "./types.js";

export const XAU_LOCK_DEFAULT_RESERVATION_TTL_MS = 10 * 60_000;
/** Two authoritative flat observations at least this far apart confirm a close. */
export const XAU_LOCK_FLAT_CONFIRM_INTERVAL_MS = 10_000;
export const XAU_LOCK_EVIDENCE_MAX_AGE_MS = 60_000;
const MAX_EVENTS = 60;
const MAX_IDEMPOTENCY = 50;

export type AcquireReservationResult =
  | { ok: true; reservationId: string; duplicate: boolean; record: XauPositionLockRecord }
  | { ok: false; code: XauLockBlockCode; message: string; record: XauPositionLockRecord };

export type ReleaseResult =
  | { released: true; reason: string; record: XauPositionLockRecord }
  | { released: false; code: string; message: string; record: XauPositionLockRecord };

function emptyRecord(nowIso: string): XauPositionLockRecord {
  return {
    schemaVersion: XAU_POSITION_LOCK_SCHEMA,
    instrument: XAU_POSITION_LOCK_INSTRUMENT,
    state: "AVAILABLE",
    stateVersion: 0,
    priorState: null,
    reservation: null,
    submission: { state: "NONE", requestId: null, brokerOrderId: null, brokerTradeId: null, updatedAtUtc: null },
    trackedTradeIds: [],
    trackedOrderIds: [],
    flatConfirmations: { count: 0, firstAtUtc: null },
    lastReconciliationAtUtc: null,
    lastEvidence: null,
    lastReleaseReason: null,
    lastReleasedAtUtc: null,
    lastReleaseEvidence: null,
    entryFreeze: {
      active: false,
      reason: null,
      raisedAtUtc: null,
      tradeId: null,
      observedLossAccountCurrency: null,
      maxRiskAccountCurrency: null,
      acknowledgedAtUtc: null,
      acknowledgedBy: null,
    },
    idempotency: {},
    events: [],
    updatedAtUtc: nowIso,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

const LOCK_STATES = new Set<XauLockState>([
  "AVAILABLE",
  "RESERVED",
  "SUBMISSION_PENDING",
  "POSITION_OPEN",
  "POSITION_CLOSING",
  "RECONCILIATION_PENDING",
  "EXTERNAL_POSITION_BLOCK",
  "UNKNOWN_BROKER_STATE",
]);

/**
 * Unreadable or foreign persisted state must never decode as AVAILABLE:
 * a corrupt lock file is treated as UNKNOWN_BROKER_STATE until reconciled.
 */
function decode(raw: unknown, nowIso: string): XauPositionLockRecord {
  if (raw === undefined) return emptyRecord(nowIso);
  const o = raw && typeof raw === "object" ? (raw as Partial<XauPositionLockRecord>) : null;
  if (!o || o.schemaVersion !== XAU_POSITION_LOCK_SCHEMA || !o.state || !LOCK_STATES.has(o.state)) {
    const rec = emptyRecord(nowIso);
    rec.state = "UNKNOWN_BROKER_STATE";
    rec.priorState = "RECONCILIATION_PENDING";
    rec.events.push({
      atUtc: nowIso,
      type: "STORE_UNREADABLE",
      from: null,
      to: "UNKNOWN_BROKER_STATE",
      code: "POSITION_RECONCILIATION_REQUIRED",
      detail: "Persisted lock unreadable — held fail-closed until broker reconciliation.",
    });
    return rec;
  }
  const base = emptyRecord(nowIso);
  return {
    ...base,
    ...o,
    submission: { ...base.submission, ...(o.submission ?? {}) },
    flatConfirmations: { ...base.flatConfirmations, ...(o.flatConfirmations ?? {}) },
    entryFreeze: { ...base.entryFreeze, ...(o.entryFreeze ?? {}) },
    trackedTradeIds: Array.isArray(o.trackedTradeIds) ? o.trackedTradeIds.map(String) : [],
    trackedOrderIds: Array.isArray(o.trackedOrderIds) ? o.trackedOrderIds.map(String) : [],
    idempotency: o.idempotency && typeof o.idempotency === "object" ? o.idempotency : {},
    events: Array.isArray(o.events) ? o.events.slice(-MAX_EVENTS) : [],
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  } as XauPositionLockRecord;
}

function nowMarker(): string {
  return JSON.stringify({ initializedAtUtc: new Date().toISOString() });
}

function evidenceIsFresh(e: XauBrokerEvidence, nowMs: number): boolean {
  const t = Date.parse(e.observedAtUtc);
  return Number.isFinite(t) && nowMs - t <= XAU_LOCK_EVIDENCE_MAX_AGE_MS;
}

export class XauPositionLockStore {
  readonly file: string;
  private readonly mutexFile: string;
  /** Written once the lock has persisted state; a later missing lock file is then fail-closed. */
  private readonly markerFile: string;

  constructor(storageRoot?: string) {
    const dir = path.join(storageRoot ?? resolveStorageRoot(), "forex-automated-trading");
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, "xau-position-lock.json");
    this.mutexFile = path.join(dir, ".xau-position-lock.mutex");
    this.markerFile = path.join(dir, ".xau-position-lock.initialized");
  }

  /** Fresh read from disk (restart-safe; no cached authority). */
  get(): XauPositionLockRecord {
    const nowIso = new Date().toISOString();
    if (!fs.existsSync(this.file)) {
      return fs.existsSync(this.markerFile) ? decode(null, nowIso) : emptyRecord(nowIso);
    }
    try {
      return decode(JSON.parse(fs.readFileSync(this.file, "utf8")), nowIso);
    } catch {
      return decode(null, nowIso);
    }
  }

  private write(rec: XauPositionLockRecord): void {
    const tmp = `${this.file}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rec, null, 2));
    fs.renameSync(tmp, this.file);
    if (!fs.existsSync(this.markerFile)) fs.writeFileSync(this.markerFile, nowMarker());
  }

  private async mutate<T>(
    fn: (rec: XauPositionLockRecord, nowIso: string) => T,
    nowMs?: number,
  ): Promise<T> {
    return withFileMutex(this.mutexFile, () => {
      const nowIso = new Date(nowMs ?? Date.now()).toISOString();
      const rec = this.get();
      const before = JSON.stringify(rec);
      const out = fn(rec, nowIso);
      if (JSON.stringify(rec) !== before) {
        rec.updatedAtUtc = nowIso;
        rec.events = rec.events.slice(-MAX_EVENTS);
        const keys = Object.keys(rec.idempotency);
        if (keys.length > MAX_IDEMPOTENCY) {
          for (const k of keys.slice(0, keys.length - MAX_IDEMPOTENCY)) delete rec.idempotency[k];
        }
        this.write(rec);
      }
      return out;
    });
  }

  private static transition(
    rec: XauPositionLockRecord,
    to: XauLockState,
    nowIso: string,
    type: string,
    code: string | null,
    detail: string,
  ): void {
    const from = rec.state;
    rec.state = to;
    rec.stateVersion += 1;
    const ev: XauLockEvent = { atUtc: nowIso, type, from, to, code, detail: detail.slice(0, 240) };
    rec.events.push(ev);
  }

  private static release(rec: XauPositionLockRecord, nowIso: string, reason: string, evidence: string): void {
    XauPositionLockStore.transition(rec, "AVAILABLE", nowIso, "RELEASED", reason, evidence);
    rec.priorState = null;
    rec.reservation = null;
    rec.submission = { state: "NONE", requestId: null, brokerOrderId: null, brokerTradeId: null, updatedAtUtc: nowIso };
    rec.trackedTradeIds = [];
    rec.trackedOrderIds = [];
    rec.flatConfirmations = { count: 0, firstAtUtc: null };
    rec.lastReleaseReason = reason;
    rec.lastReleasedAtUtc = nowIso;
    rec.lastReleaseEvidence = evidence.slice(0, 400);
  }

  private static recordEvidence(rec: XauPositionLockRecord, e: XauBrokerEvidence, nowIso: string): void {
    rec.lastReconciliationAtUtc = nowIso;
    rec.lastEvidence = {
      status: e.status,
      observedAtUtc: e.observedAtUtc,
      positions: e.positions.slice(0, 10),
      pendingOrders: e.pendingOrders.slice(0, 10),
      reasonCodes: e.reasonCodes.slice(0, 10),
    };
  }

  /**
   * Atomically reserve the single XAU/USD slot for one proposal.
   * Requires fresh broker evidence of no XAU exposure. Duplicate requests return the same reservation.
   */
  async acquireReservation(input: {
    proposalId: string;
    idempotencyKey: string;
    riskDecisionId?: string | null;
    accountBindingHash?: string | null;
    accountRiskSnapshotId?: string | null;
    maxRiskAccountCurrency?: number | null;
    accountCurrency?: string | null;
    evidence: XauBrokerEvidence;
    ttlMs?: number;
    nowMs?: number;
  }): Promise<AcquireReservationResult> {
    const nowMs = input.nowMs ?? Date.now();
    return this.mutate((rec, nowIso) => {
      const blocked = (code: XauLockBlockCode, message: string): AcquireReservationResult => {
        rec.idempotency[input.idempotencyKey] = {
          proposalId: input.proposalId,
          reservationId: null,
          outcome: code,
          atUtc: nowIso,
        };
        return { ok: false, code, message, record: rec };
      };

      const r = rec.reservation;
      if (r && (r.idempotencyKey === input.idempotencyKey || r.proposalId === input.proposalId)) {
        return { ok: true, reservationId: r.reservationId, duplicate: true, record: rec };
      }
      if (rec.entryFreeze.active) {
        return blocked("RISK_BREACH_ENTRY_FREEZE", `Entries frozen after risk breach: ${rec.entryFreeze.reason ?? "unacknowledged"}.`);
      }
      if (rec.state !== "AVAILABLE") {
        return blocked("POSITION_LOCK_HELD", `XAU/USD position lock is held (${rec.state}).`);
      }
      const e = input.evidence;
      if (!evidenceIsFresh(e, nowMs)) {
        return blocked("BROKER_STATE_UNKNOWN", "Broker exposure evidence is stale — fresh read-only reconciliation required.");
      }
      XauPositionLockStore.recordEvidence(rec, e, nowIso);
      if (
        input.accountBindingHash
        && e.accountBindingHash
        && input.accountBindingHash !== e.accountBindingHash
      ) {
        return blocked("ACCOUNT_IDENTITY_UNVERIFIED", "Broker evidence account differs from the proposal's risk snapshot account.");
      }
      if (e.status === "UNKNOWN") {
        return blocked("BROKER_STATE_UNKNOWN", `Broker XAU/USD state unknown (${e.reasonCodes.join(",") || "UNKNOWN"}).`);
      }
      if (e.status === "OCCUPIED") {
        XauPositionLockStore.transition(
          rec,
          "EXTERNAL_POSITION_BLOCK",
          nowIso,
          "EXTERNAL_EXPOSURE_OBSERVED",
          e.positions.length > 0 ? "EXTERNAL_XAU_POSITION_PRESENT" : "XAU_PENDING_ORDER_PRESENT",
          `positions=${e.positions.length} pendingOrders=${e.pendingOrders.length} — automated entry blocked; not managed.`,
        );
        rec.flatConfirmations = { count: 0, firstAtUtc: null };
        return e.positions.length > 0
          ? blocked("EXTERNAL_XAU_POSITION_PRESENT", "An XAU/USD position not opened by Automated Trading exists — automated entry blocked.")
          : blocked("XAU_PENDING_ORDER_PRESENT", "A pending XAU/USD order exists — automated entry blocked.");
      }
      const reservationId = randomUUID();
      rec.reservation = {
        reservationId,
        proposalId: input.proposalId,
        idempotencyKey: input.idempotencyKey,
        riskDecisionId: input.riskDecisionId ?? null,
        accountBindingHash: input.accountBindingHash ?? e.accountBindingHash ?? null,
        accountRiskSnapshotId: input.accountRiskSnapshotId ?? null,
        maxRiskAccountCurrency: input.maxRiskAccountCurrency ?? null,
        accountCurrency: input.accountCurrency ?? null,
        reservedAtUtc: nowIso,
        expiresAtUtc: new Date(nowMs + (input.ttlMs ?? XAU_LOCK_DEFAULT_RESERVATION_TTL_MS)).toISOString(),
      };
      rec.submission = { state: "NONE", requestId: null, brokerOrderId: null, brokerTradeId: null, updatedAtUtc: nowIso };
      rec.flatConfirmations = { count: 0, firstAtUtc: null };
      XauPositionLockStore.transition(rec, "RESERVED", nowIso, "RESERVED", null, `proposal ${input.proposalId}`);
      rec.idempotency[input.idempotencyKey] = {
        proposalId: input.proposalId,
        reservationId,
        outcome: "RESERVED",
        atUtc: nowIso,
      };
      return { ok: true, reservationId, duplicate: false, record: rec };
    }, nowMs);
  }

  /** True when this proposal currently holds the reservation. */
  isReservedFor(proposalId: string): boolean {
    const rec = this.get();
    return rec.reservation?.proposalId === proposalId
      && (rec.state === "RESERVED" || rec.state === "SUBMISSION_PENDING");
  }

  /**
   * Release a reservation whose proposal ended without any submission
   * (precheck/handoff blocked, or execution boundary disabled) — still requires broker-flat evidence.
   */
  async releaseUnsubmittedReservation(input: {
    proposalId: string;
    reason: string;
    evidence: XauBrokerEvidence;
    nowMs?: number;
  }): Promise<ReleaseResult> {
    const nowMs = input.nowMs ?? Date.now();
    return this.mutate((rec, nowIso) => {
      const r = rec.reservation;
      if (!r || r.proposalId !== input.proposalId) {
        return { released: false, code: "NOT_RESERVED_FOR_PROPOSAL", message: "Proposal does not hold the reservation.", record: rec };
      }
      if (rec.state !== "RESERVED" || rec.submission.state !== "NONE") {
        return { released: false, code: "SUBMISSION_UNRESOLVED", message: `Lock ${rec.state}/${rec.submission.state} — not an unsubmitted reservation.`, record: rec };
      }
      XauPositionLockStore.recordEvidence(rec, input.evidence, nowIso);
      if (!evidenceIsFresh(input.evidence, nowMs) || input.evidence.status !== "CONFIRMED_FLAT") {
        return { released: false, code: "BROKER_STATE_UNKNOWN", message: "Broker has not confirmed XAU/USD flat — reservation kept.", record: rec };
      }
      XauPositionLockStore.release(
        rec,
        nowIso,
        `UNSUBMITTED_RESERVATION_RELEASED:${input.reason}`.slice(0, 120),
        `broker CONFIRMED_FLAT @ ${input.evidence.observedAtUtc}; submission NONE`,
      );
      return { released: true, reason: rec.lastReleaseReason!, record: rec };
    }, nowMs);
  }

  /** Future submit path only — records intent; never contacts the broker. */
  async recordSubmissionPending(input: { reservationId: string; requestId: string; nowMs?: number }): Promise<XauPositionLockRecord> {
    return this.mutate((rec, nowIso) => {
      if (rec.reservation?.reservationId !== input.reservationId) return rec;
      rec.submission = { ...rec.submission, state: "PENDING", requestId: input.requestId, updatedAtUtc: nowIso };
      XauPositionLockStore.transition(rec, "SUBMISSION_PENDING", nowIso, "SUBMISSION_PENDING", null, input.requestId);
      return rec;
    }, input.nowMs);
  }

  /** Future submit path only — ACKNOWLEDGED/REJECTED/UNKNOWN_OUTCOME; release still needs broker evidence. */
  async recordSubmissionOutcome(input: {
    reservationId: string;
    outcome: "ACKNOWLEDGED" | "REJECTED" | "UNKNOWN_OUTCOME";
    brokerOrderId?: string | null;
    brokerTradeId?: string | null;
    nowMs?: number;
  }): Promise<XauPositionLockRecord> {
    return this.mutate((rec, nowIso) => {
      if (rec.reservation?.reservationId !== input.reservationId) return rec;
      rec.submission = {
        ...rec.submission,
        state: input.outcome,
        brokerOrderId: input.brokerOrderId ?? rec.submission.brokerOrderId,
        brokerTradeId: input.brokerTradeId ?? rec.submission.brokerTradeId,
        updatedAtUtc: nowIso,
      };
      if (input.brokerOrderId && !rec.trackedOrderIds.includes(input.brokerOrderId)) rec.trackedOrderIds.push(input.brokerOrderId);
      if (input.brokerTradeId && !rec.trackedTradeIds.includes(input.brokerTradeId)) rec.trackedTradeIds.push(input.brokerTradeId);
      const to: XauLockState = input.outcome === "ACKNOWLEDGED"
        ? "SUBMISSION_PENDING"
        : input.outcome === "REJECTED"
          ? "RECONCILIATION_PENDING"
          : "UNKNOWN_BROKER_STATE";
      if (to === "UNKNOWN_BROKER_STATE") rec.priorState = "SUBMISSION_PENDING";
      XauPositionLockStore.transition(rec, to, nowIso, `SUBMISSION_${input.outcome}`, null, input.brokerOrderId ?? "");
      return rec;
    }, input.nowMs);
  }

  /**
   * Apply read-only broker evidence. Never releases on uncertainty; a close is confirmed by
   * ClosedTrades containing a tracked trade, or two authoritative flat observations ≥ interval apart.
   */
  async reconcile(
    evidence: XauBrokerEvidence,
    opts: { nowMs?: number; confirmIntervalMs?: number } = {},
  ): Promise<XauPositionLockRecord> {
    const nowMs = opts.nowMs ?? Date.now();
    const confirmMs = opts.confirmIntervalMs ?? XAU_LOCK_FLAT_CONFIRM_INTERVAL_MS;
    return this.mutate((rec, nowIso) => {
      XauPositionLockStore.recordEvidence(rec, evidence, nowIso);
      const T = XauPositionLockStore.transition;
      const held = rec.state !== "AVAILABLE";
      const accountMismatch = Boolean(
        rec.reservation?.accountBindingHash
        && evidence.accountBindingHash
        && rec.reservation.accountBindingHash !== evidence.accountBindingHash,
      );

      if (evidence.status === "UNKNOWN" || accountMismatch || !evidenceIsFresh(evidence, nowMs)) {
        if (held && rec.state !== "UNKNOWN_BROKER_STATE") {
          rec.priorState = rec.state;
          T(rec, "UNKNOWN_BROKER_STATE", nowIso, "BROKER_STATE_UNKNOWN",
            accountMismatch ? "ACCOUNT_IDENTITY_UNVERIFIED" : "BROKER_STATE_UNKNOWN",
            `kept locked: ${evidence.reasonCodes.join(",") || "stale evidence"}`);
        }
        rec.flatConfirmations = { count: 0, firstAtUtc: null };
        return rec;
      }

      if (evidence.status === "OCCUPIED") {
        rec.flatConfirmations = { count: 0, firstAtUtc: null };
        const automatedPos = evidence.positions.some((p) => p.ownership === "AUTOMATED");
        const automatedOrder = evidence.pendingOrders.some((o) => o.ownership === "AUTOMATED");
        const external = evidence.positions.some((p) => p.ownership !== "AUTOMATED")
          || evidence.pendingOrders.some((o) => o.ownership !== "AUTOMATED");
        let to: XauLockState = rec.state;
        if (automatedPos) to = rec.state === "POSITION_CLOSING" ? "POSITION_CLOSING" : "POSITION_OPEN";
        else if (automatedOrder) to = "SUBMISSION_PENDING";
        else if (external) to = "EXTERNAL_POSITION_BLOCK";
        if (to !== rec.state) {
          T(rec, to, nowIso, "BROKER_EXPOSURE_OBSERVED", evidence.reasonCodes[0] ?? null,
            `positions=${evidence.positions.length} pendingOrders=${evidence.pendingOrders.length}`);
        }
        rec.priorState = null;
        return rec;
      }

      // CONFIRMED_FLAT
      if (rec.state === "AVAILABLE") return rec;
      const sub = rec.submission.state;
      if (sub === "PENDING" || sub === "UNKNOWN_OUTCOME") {
        if (rec.state !== "UNKNOWN_BROKER_STATE" && rec.state !== "SUBMISSION_PENDING") {
          T(rec, "RECONCILIATION_PENDING", nowIso, "SUBMISSION_UNRESOLVED", "POSITION_RECONCILIATION_REQUIRED",
            "Broker flat but submission outcome unresolved — kept locked.");
        }
        return rec;
      }
      if (rec.state === "UNKNOWN_BROKER_STATE" && rec.priorState === "RESERVED" && sub === "NONE" && rec.reservation) {
        T(rec, "RESERVED", nowIso, "BROKER_STATE_RESTORED", null,
          "Broker confirmed flat after uncertainty — unsubmitted reservation restored, not released.");
        rec.priorState = null;
      }
      if (rec.state === "RESERVED") {
        const exp = rec.reservation ? Date.parse(rec.reservation.expiresAtUtc) : NaN;
        if (sub === "NONE" && Number.isFinite(exp) && nowMs > exp) {
          XauPositionLockStore.release(rec, nowIso, "RESERVATION_EXPIRED_BROKER_FLAT",
            `reservation expired ${rec.reservation?.expiresAtUtc}; broker CONFIRMED_FLAT @ ${evidence.observedAtUtc}; submission NONE`);
        }
        return rec;
      }
      if (!evidence.accountBindingHash) {
        if (rec.state !== "RECONCILIATION_PENDING") {
          T(rec, "RECONCILIATION_PENDING", nowIso, "ACCOUNT_IDENTITY_UNVERIFIED", "POSITION_RECONCILIATION_REQUIRED",
            "Broker flat but account identity unverified — kept locked.");
        }
        return rec;
      }
      const trackedTrades = new Set(rec.trackedTradeIds);
      const trackedOrders = new Set(rec.trackedOrderIds);
      const closedMatch = evidence.closedTradeIds.some((id) => trackedTrades.has(id))
        || (evidence.closedOrderIds ?? []).some((id) => trackedOrders.has(id));
      if (closedMatch) {
        XauPositionLockStore.release(rec, nowIso, "BROKER_CONFIRMED_CLOSED",
          `ClosedTrades contains tracked trade; no XAU positions/orders @ ${evidence.observedAtUtc}`);
        return rec;
      }
      // A tracked automated position/order is released only by broker ClosedTrades evidence —
      // flat Trades/Orders reads alone can lag the broker lifecycle.
      const trackedExposure = trackedTrades.size > 0 || (trackedOrders.size > 0 && sub !== "REJECTED");
      if (trackedExposure) {
        rec.flatConfirmations = { count: 0, firstAtUtc: null };
        if (rec.state !== "RECONCILIATION_PENDING") {
          T(rec, "RECONCILIATION_PENDING", nowIso, "FLAT_WITHOUT_CLOSE_CONFIRMATION", "POSITION_RECONCILIATION_REQUIRED",
            "Tracked position absent from Trades but no ClosedTrades confirmation — kept locked.");
        }
        rec.priorState = null;
        return rec;
      }
      const first = rec.flatConfirmations.firstAtUtc ? Date.parse(rec.flatConfirmations.firstAtUtc) : NaN;
      if (rec.flatConfirmations.count >= 1 && Number.isFinite(first) && nowMs - first >= confirmMs) {
        XauPositionLockStore.release(rec, nowIso, "BROKER_CONFIRMED_FLAT",
          `two authoritative flat observations ${rec.flatConfirmations.firstAtUtc} → ${evidence.observedAtUtc}; no pending XAU orders`);
        return rec;
      }
      if (rec.flatConfirmations.count === 0) {
        rec.flatConfirmations = { count: 1, firstAtUtc: nowIso };
      }
      if (rec.state !== "RECONCILIATION_PENDING") {
        T(rec, "RECONCILIATION_PENDING", nowIso, "FLAT_OBSERVED", null,
          "First authoritative flat observation — awaiting confirmation before release.");
      }
      rec.priorState = null;
      return rec;
    }, nowMs);
  }

  /** Critical 25% breach: freeze new XAU/USD entries. Never closes or modifies the position. */
  async raiseRiskBreach(input: {
    tradeId: string | null;
    observedLossAccountCurrency: number;
    maxRiskAccountCurrency: number;
    reason: string;
    nowMs?: number;
  }): Promise<XauPositionLockRecord> {
    return this.mutate((rec, nowIso) => {
      if (rec.entryFreeze.active) return rec;
      rec.entryFreeze = {
        active: true,
        reason: input.reason.slice(0, 200),
        raisedAtUtc: nowIso,
        tradeId: input.tradeId,
        observedLossAccountCurrency: input.observedLossAccountCurrency,
        maxRiskAccountCurrency: input.maxRiskAccountCurrency,
        acknowledgedAtUtc: null,
        acknowledgedBy: null,
      };
      rec.events.push({
        atUtc: nowIso,
        type: "RISK_BREACH",
        from: rec.state,
        to: rec.state,
        code: "RISK_LIMIT_EXCEEDED",
        detail: `observed loss ${input.observedLossAccountCurrency} ≥ captured 25% budget ${input.maxRiskAccountCurrency}; entries frozen; no broker action.`,
      });
      return rec;
    }, input.nowMs);
  }

  /** Owner clears the freeze — only after the lock has been reconciled back to AVAILABLE. */
  async acknowledgeRiskBreach(input: { operator: string; nowMs?: number }): Promise<
    { ok: true; record: XauPositionLockRecord } | { ok: false; code: string; message: string; record: XauPositionLockRecord }
  > {
    return this.mutate((rec, nowIso) => {
      if (!rec.entryFreeze.active) return { ok: true as const, record: rec };
      const operator = input.operator.slice(0, 60);
      // Acknowledgement is always recorded; it never releases the lock or touches the broker.
      rec.entryFreeze = { ...rec.entryFreeze, acknowledgedAtUtc: nowIso, acknowledgedBy: operator };
      if (rec.state !== "AVAILABLE") {
        rec.events.push({
          atUtc: nowIso,
          type: "RISK_BREACH_ACKNOWLEDGED",
          from: rec.state,
          to: rec.state,
          code: "RISK_BREACH_UNRESOLVED",
          detail: `${operator}: acknowledged; freeze kept until broker-confirmed close`,
        });
        return {
          ok: false as const,
          code: "POSITION_RECONCILIATION_REQUIRED",
          message: `Acknowledged, but lock is ${rec.state} — entries stay frozen until the broker confirms the position closed.`,
          record: rec,
        };
      }
      rec.entryFreeze = { ...rec.entryFreeze, active: false };
      rec.events.push({ atUtc: nowIso, type: "RISK_BREACH_ACKNOWLEDGED", from: rec.state, to: rec.state, code: "RISK_BREACH_CLEARED", detail: `${operator}: lock AVAILABLE — freeze cleared` });
      return { ok: true as const, record: rec };
    }, input.nowMs);
  }
}

let singleton: XauPositionLockStore | null = null;

export function getXauPositionLockStore(storageRoot?: string): XauPositionLockStore {
  if (storageRoot) return new XauPositionLockStore(storageRoot);
  if (!singleton) singleton = new XauPositionLockStore();
  return singleton;
}

export function resetXauPositionLockStoreForTests(): void {
  singleton = null;
}

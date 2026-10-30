/**
 * Phase 3.10 — Critical alert emission for DEMO unprotected / unsafe fills.
 *
 * Delivery policy (fail-closed, no customer spam):
 * - Always attempts a local audit sink (structured record).
 * - Never sends email/SMS/push to customers from this module.
 * - Optional test sink can be injected for unit tests (success/fail/retry).
 * - Duplicate suppression by dedupeKey within a TTL window.
 */

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";

export interface CriticalAlertPayload {
  code: string;
  message: string;
  lifecycleId?: string | null;
  tradeId?: string | null;
  instrument?: string | null;
  /** Stable key for duplicate suppression. */
  dedupeKey: string;
  evidence?: Record<string, unknown>;
}

export interface CriticalAlertAttempt {
  attempt: number;
  ok: boolean;
  channel: string;
  error: string | null;
  atUtc: string;
}

export interface CriticalAlertResult {
  ok: boolean;
  delivered: boolean;
  suppressedDuplicate: boolean;
  attempts: CriticalAlertAttempt[];
  channel: string;
  alertId: string;
  code: string;
  /** True when at least the local audit record was persisted. */
  localAuditRecorded: boolean;
  error: string | null;
}

export interface CriticalAlertSink {
  readonly channel: string;
  deliver(payload: CriticalAlertPayload & { alertId: string }): Promise<{ ok: boolean; error?: string }>;
}

const DEFAULT_DEDUPE_TTL_MS = 15 * 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;

const recentDedupe = new Map<string, number>();

let testSink: CriticalAlertSink | null = null;
let localAuditFailForTests = false;

export function resetCriticalAlertStateForTests(): void {
  recentDedupe.clear();
  testSink = null;
  localAuditFailForTests = false;
}

export function setCriticalAlertTestSinkForTests(sink: CriticalAlertSink | null): void {
  testSink = sink;
}

export function setCriticalAlertLocalAuditFailForTests(fail: boolean): void {
  localAuditFailForTests = fail;
}

function nowIso(): string {
  return new Date().toISOString();
}

function alertIdFor(payload: CriticalAlertPayload): string {
  const h = createHash("sha256")
    .update(`${payload.dedupeKey}|${payload.code}|${payload.lifecycleId ?? ""}`)
    .digest("hex")
    .slice(0, 16);
  return `crit_${h}`;
}

function localAuditPath(): string {
  return join(resolveStorageRoot(), "forex", "critical-alerts.jsonl");
}

function writeLocalAudit(record: Record<string, unknown>): { ok: boolean; error: string | null } {
  if (localAuditFailForTests) {
    return { ok: false, error: "LOCAL_AUDIT_FORCED_FAILURE" };
  }
  try {
    const path = localAuditPath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(record)}\n`, "utf8");
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function isDuplicate(dedupeKey: string, ttlMs: number, nowMs: number): boolean {
  const prev = recentDedupe.get(dedupeKey);
  if (prev != null && nowMs - prev < ttlMs) return true;
  recentDedupe.set(dedupeKey, nowMs);
  // Opportunistic prune
  if (recentDedupe.size > 500) {
    for (const [k, ts] of recentDedupe) {
      if (nowMs - ts >= ttlMs) recentDedupe.delete(k);
    }
  }
  return false;
}

/**
 * Emit a critical alert. Never contacts customers.
 * Retries the primary sink (test sink or local-audit-only acknowledgment path).
 */
export async function emitCriticalAlert(
  payload: CriticalAlertPayload,
  options?: {
    maxAttempts?: number;
    dedupeTtlMs?: number;
    nowMs?: number;
  },
): Promise<CriticalAlertResult> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const dedupeTtlMs = options?.dedupeTtlMs ?? DEFAULT_DEDUPE_TTL_MS;
  const nowMs = options?.nowMs ?? Date.now();
  const alertId = alertIdFor(payload);
  const attempts: CriticalAlertAttempt[] = [];

  if (isDuplicate(payload.dedupeKey, dedupeTtlMs, nowMs)) {
    return {
      ok: true,
      delivered: false,
      suppressedDuplicate: true,
      attempts,
      channel: "dedupe",
      alertId,
      code: payload.code,
      localAuditRecorded: false,
      error: null,
    };
  }

  const audit = writeLocalAudit({
    alertId,
    atUtc: nowIso(),
    code: payload.code,
    message: payload.message,
    lifecycleId: payload.lifecycleId ?? null,
    tradeId: payload.tradeId ?? null,
    instrument: payload.instrument ?? null,
    dedupeKey: payload.dedupeKey,
    evidence: payload.evidence ?? {},
    customerDelivery: false,
  });

  const sink: CriticalAlertSink = testSink ?? {
    channel: "local-audit",
    async deliver() {
      // Local audit is the authoritative non-customer channel.
      return audit.ok
        ? { ok: true }
        : { ok: false, error: audit.error ?? "LOCAL_AUDIT_FAILED" };
    },
  };

  let delivered = false;
  let lastError: string | null = audit.ok ? null : audit.error;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await sink.deliver({ ...payload, alertId });
      attempts.push({
        attempt,
        ok: Boolean(result.ok),
        channel: sink.channel,
        error: result.ok ? null : (result.error ?? "DELIVERY_FAILED"),
        atUtc: nowIso(),
      });
      if (result.ok) {
        delivered = true;
        lastError = null;
        break;
      }
      lastError = result.error ?? "DELIVERY_FAILED";
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      attempts.push({
        attempt,
        ok: false,
        channel: sink.channel,
        error: lastError,
        atUtc: nowIso(),
      });
    }
  }

  return {
    ok: delivered && audit.ok,
    delivered,
    suppressedDuplicate: false,
    attempts,
    channel: sink.channel,
    alertId,
    code: payload.code,
    localAuditRecorded: audit.ok,
    error: delivered && audit.ok ? null : lastError,
  };
}

/** Test helper: whether audit file exists (path may be empty). */
export function criticalAlertAuditPathExistsForTests(): boolean {
  return existsSync(localAuditPath());
}

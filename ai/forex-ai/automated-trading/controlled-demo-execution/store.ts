/**
 * Stage 7 — Persist grants, attempts, audit (no broker mutation records from live submit).
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomicSync } from "../../../../storage/safe-json.js";
import {
  AT_CONTROLLED_DEMO_PHASE,
  AT_CONTROLLED_DEMO_SCHEMA,
  AT_CONTROLLED_DEMO_STAGE,
  type Stage7AuditEvent,
  type Stage7ExecutionAttempt,
  type Stage7ExecutionGrant,
  type Stage7ReadinessReport,
} from "./types.js";

const MAX_ATTEMPTS = 80;
const MAX_GRANTS = 40;
const MAX_AUDIT = 200;

interface StoreFile {
  schemaVersion: typeof AT_CONTROLLED_DEMO_SCHEMA;
  stage: typeof AT_CONTROLLED_DEMO_STAGE;
  phase: typeof AT_CONTROLLED_DEMO_PHASE;
  activeGrantId: string | null;
  grants: Stage7ExecutionGrant[];
  attempts: Stage7ExecutionAttempt[];
  byIdempotencyKey: Record<string, string>;
  audit: Stage7AuditEvent[];
  latestReadiness: Stage7ReadinessReport | null;
}

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "controlled-demo-execution.json",
  );
}

function empty(): StoreFile {
  return {
    schemaVersion: AT_CONTROLLED_DEMO_SCHEMA,
    stage: AT_CONTROLLED_DEMO_STAGE,
    phase: AT_CONTROLLED_DEMO_PHASE,
    activeGrantId: null,
    grants: [],
    attempts: [],
    byIdempotencyKey: {},
    audit: [],
    latestReadiness: null,
  };
}

function normalize(raw: unknown): StoreFile {
  const base = empty();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    ...base,
    activeGrantId: typeof o.activeGrantId === "string" ? o.activeGrantId : null,
    grants: Array.isArray(o.grants) ? (o.grants as Stage7ExecutionGrant[]).slice(0, MAX_GRANTS) : [],
    attempts: Array.isArray(o.attempts) ? (o.attempts as Stage7ExecutionAttempt[]).slice(0, MAX_ATTEMPTS) : [],
    byIdempotencyKey:
      o.byIdempotencyKey && typeof o.byIdempotencyKey === "object"
        ? Object.fromEntries(
          Object.entries(o.byIdempotencyKey as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string"),
        ) as Record<string, string>
        : {},
    audit: Array.isArray(o.audit) ? (o.audit as Stage7AuditEvent[]).slice(0, MAX_AUDIT) : [],
    latestReadiness: (o.latestReadiness as Stage7ReadinessReport | null) ?? null,
  };
}

export class ControlledDemoExecutionStore {
  private data: StoreFile;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  private persist(): void {
    writeJsonAtomicSync(this.file, this.data);
  }

  appendAudit(partial: Omit<Stage7AuditEvent, "id" | "placesOrders" | "mutatesBroker"> & { id?: string }): void {
    const ev: Stage7AuditEvent = {
      id: partial.id ?? randomUUID(),
      atUtc: partial.atUtc,
      actor: partial.actor,
      action: partial.action,
      detail: partial.detail,
      correlationId: partial.correlationId,
      proposalId: partial.proposalId,
      grantId: partial.grantId,
      attemptId: partial.attemptId,
      blockerCodes: partial.blockerCodes ?? [],
      placesOrders: false,
      mutatesBroker: false,
    };
    this.data.audit = [ev, ...this.data.audit].slice(0, MAX_AUDIT);
    this.persist();
  }

  listAudit(limit = 40): Stage7AuditEvent[] {
    return this.data.audit.slice(0, Math.max(1, Math.min(MAX_AUDIT, limit)));
  }

  saveReadiness(report: Stage7ReadinessReport): void {
    this.data.latestReadiness = report;
    this.persist();
  }

  latestReadiness(): Stage7ReadinessReport | null {
    return this.data.latestReadiness;
  }

  activeGrant(nowMs = Date.now()): Stage7ExecutionGrant | null {
    const id = this.data.activeGrantId;
    if (!id) return null;
    const g = this.data.grants.find((x) => x.grantId === id) ?? null;
    if (!g) return null;
    if (g.revokedAtUtc || g.usedAtUtc) return null;
    const exp = Date.parse(g.expiresAtUtc);
    if (!Number.isFinite(exp) || nowMs > exp) return null;
    return g;
  }

  setActiveGrant(grant: Stage7ExecutionGrant): void {
    this.data.grants = [grant, ...this.data.grants.filter((g) => g.grantId !== grant.grantId)].slice(0, MAX_GRANTS);
    this.data.activeGrantId = grant.grantId;
    this.persist();
  }

  updateGrant(grant: Stage7ExecutionGrant): void {
    this.data.grants = this.data.grants.map((g) => (g.grantId === grant.grantId ? grant : g));
    if (grant.revokedAtUtc || grant.usedAtUtc) {
      if (this.data.activeGrantId === grant.grantId) this.data.activeGrantId = null;
    }
    this.persist();
  }

  clearActiveGrant(): void {
    this.data.activeGrantId = null;
    this.persist();
  }

  listGrants(limit = 20): Stage7ExecutionGrant[] {
    return this.data.grants.slice(0, Math.max(1, Math.min(MAX_GRANTS, limit)));
  }

  getAttemptByIdempotency(key: string): Stage7ExecutionAttempt | null {
    const id = this.data.byIdempotencyKey[key];
    if (!id) return null;
    return this.data.attempts.find((a) => a.attemptId === id) ?? null;
  }

  hasUnresolvedAttemptForProposal(proposalId: string): boolean {
    const unresolved = new Set([
      "SUBMISSION_PENDING",
      "UNKNOWN",
      "RECONCILIATION_REQUIRED",
      "PROTECTION_PENDING",
    ]);
    return this.data.attempts.some(
      (a) => a.proposalSnapshot.proposalId === proposalId && unresolved.has(a.state),
    );
  }

  upsertAttempt(attempt: Stage7ExecutionAttempt): { attempt: Stage7ExecutionAttempt; duplicate: boolean } {
    const existing = this.getAttemptByIdempotency(attempt.idempotencyKey);
    if (existing) return { attempt: existing, duplicate: true };
    this.data.byIdempotencyKey[attempt.idempotencyKey] = attempt.attemptId;
    this.data.attempts = [attempt, ...this.data.attempts].slice(0, MAX_ATTEMPTS);
    this.persist();
    return { attempt, duplicate: false };
  }

  latestAttempt(): Stage7ExecutionAttempt | null {
    return this.data.attempts[0] ?? null;
  }

  listAttempts(limit = 40): Stage7ExecutionAttempt[] {
    return this.data.attempts.slice(0, Math.max(1, Math.min(MAX_ATTEMPTS, limit)));
  }

  grantCount(): number {
    return this.data.grants.length;
  }

  attemptCount(): number {
    return this.data.attempts.length;
  }

  auditCount(): number {
    return this.data.audit.length;
  }
}

let singleton: ControlledDemoExecutionStore | null = null;

export function getControlledDemoExecutionStore(storageRoot?: string): ControlledDemoExecutionStore {
  if (storageRoot) return new ControlledDemoExecutionStore(storageRoot);
  if (!singleton) singleton = new ControlledDemoExecutionStore();
  return singleton;
}

export function resetControlledDemoExecutionStoreForTests(storageRoot?: string): ControlledDemoExecutionStore {
  singleton = new ControlledDemoExecutionStore(storageRoot);
  return singleton;
}

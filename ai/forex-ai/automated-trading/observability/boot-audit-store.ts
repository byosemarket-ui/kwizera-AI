/**
 * Phase 4 — Persisted AT boot audit (bootId + step outcomes).
 * Never mutates broker state. Never overrides System Master ownerState.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import {
  AT_BOOT_AUDIT_SCHEMA,
  type AtBootAuditRecord,
} from "./types.js";

export interface AtBootAuditStoreState {
  schemaVersion: typeof AT_BOOT_AUDIT_SCHEMA;
  latest: AtBootAuditRecord | null;
  history: AtBootAuditRecord[];
}

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "boot-audit.json",
  );
}

function emptyState(): AtBootAuditStoreState {
  return { schemaVersion: AT_BOOT_AUDIT_SCHEMA, latest: null, history: [] };
}

function normalize(raw: unknown): AtBootAuditRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.bootId !== "string" || !o.bootId.trim()) return null;
  return {
    schemaVersion: AT_BOOT_AUDIT_SCHEMA,
    bootId: o.bootId,
    startedAtUtc: typeof o.startedAtUtc === "string" ? o.startedAtUtc : new Date().toISOString(),
    completedAtUtc: typeof o.completedAtUtc === "string" ? o.completedAtUtc : null,
    status: (typeof o.status === "string" ? o.status : "STARTED") as AtBootAuditRecord["status"],
    systemMasterOwnerState:
      o.systemMasterOwnerState === "ON" || o.systemMasterOwnerState === "OFF"
        ? o.systemMasterOwnerState
        : "UNKNOWN",
    analysisScheduleResumed: o.analysisScheduleResumed === true,
    monitorEnabled: o.monitorEnabled === true,
    blockers: Array.isArray(o.blockers) ? o.blockers.map(String).slice(0, 24) : [],
    steps: Array.isArray(o.steps)
      ? o.steps.slice(0, 32).map((s) => {
          const x = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
          return {
            step: String(x.step ?? "unknown"),
            ok: x.ok === true,
            code: typeof x.code === "string" ? x.code : null,
            detail: String(x.detail ?? "").slice(0, 240),
            atUtc: typeof x.atUtc === "string" ? x.atUtc : new Date().toISOString(),
          };
        })
      : [],
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note: typeof o.note === "string" ? o.note.slice(0, 280) : "AT boot audit.",
  };
}

export class AtBootAuditStore {
  private data: AtBootAuditStoreState;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const raw = readJsonSafeSync(this.file, null).value;
    if (raw && typeof raw === "object" && (raw as { schemaVersion?: string }).schemaVersion === AT_BOOT_AUDIT_SCHEMA) {
      const o = raw as Record<string, unknown>;
      const history = Array.isArray(o.history)
        ? o.history.map(normalize).filter((x): x is AtBootAuditRecord => Boolean(x)).slice(-20)
        : [];
      this.data = {
        schemaVersion: AT_BOOT_AUDIT_SCHEMA,
        latest: normalize(o.latest),
        history,
      };
    } else {
      this.data = emptyState();
    }
  }

  getLatest(): AtBootAuditRecord | null {
    return this.data.latest
      ? {
          ...this.data.latest,
          blockers: [...this.data.latest.blockers],
          steps: this.data.latest.steps.map((s) => ({ ...s })),
        }
      : null;
  }

  begin(input?: { systemMasterOwnerState?: "ON" | "OFF" | "UNKNOWN" }): AtBootAuditRecord {
    const now = new Date().toISOString();
    const record: AtBootAuditRecord = {
      schemaVersion: AT_BOOT_AUDIT_SCHEMA,
      bootId: randomUUID(),
      startedAtUtc: now,
      completedAtUtc: null,
      status: "STARTED",
      systemMasterOwnerState: input?.systemMasterOwnerState ?? "UNKNOWN",
      analysisScheduleResumed: false,
      monitorEnabled: false,
      blockers: [],
      steps: [
        {
          step: "boot_started",
          ok: true,
          code: null,
          detail: "Phase 4 AT boot coordinator started.",
          atUtc: now,
        },
      ],
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      note: "AT boot in progress — System Master owner state is never overridden.",
    };
    this.data.latest = record;
    return this.getLatest()!;
  }

  async appendStep(
    bootId: string,
    step: { step: string; ok: boolean; code?: string | null; detail: string },
  ): Promise<AtBootAuditRecord | null> {
    const cur = this.data.latest;
    if (!cur || cur.bootId !== bootId) return null;
    const next: AtBootAuditRecord = {
      ...cur,
      steps: [
        ...cur.steps,
        {
          step: step.step,
          ok: step.ok,
          code: step.code ?? null,
          detail: step.detail.slice(0, 240),
          atUtc: new Date().toISOString(),
        },
      ].slice(-32),
      blockers: step.ok ? cur.blockers : [...cur.blockers, step.code || step.step].slice(0, 24),
    };
    this.data.latest = next;
    await writeJsonAtomic(this.file, this.data);
    return this.getLatest();
  }

  async complete(
    bootId: string,
    patch: Partial<Pick<AtBootAuditRecord, "status" | "analysisScheduleResumed" | "monitorEnabled" | "systemMasterOwnerState" | "note">>,
  ): Promise<AtBootAuditRecord | null> {
    const cur = this.data.latest;
    if (!cur || cur.bootId !== bootId) return null;
    const next: AtBootAuditRecord = {
      ...cur,
      ...patch,
      schemaVersion: AT_BOOT_AUDIT_SCHEMA,
      bootId,
      completedAtUtc: new Date().toISOString(),
      status: patch.status ?? (cur.blockers.length ? "COMPLETED_WITH_WARNINGS" : "COMPLETED"),
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    };
    this.data.latest = next;
    this.data.history = [...this.data.history, next].slice(-20);
    await writeJsonAtomic(this.file, this.data);
    return this.getLatest();
  }
}

let singleton: AtBootAuditStore | null = null;

export function getAtBootAuditStore(storageRoot?: string): AtBootAuditStore {
  if (storageRoot) return new AtBootAuditStore(storageRoot);
  if (!singleton) singleton = new AtBootAuditStore();
  return singleton;
}

export function resetAtBootAuditStoreForTests(): void {
  singleton = null;
}

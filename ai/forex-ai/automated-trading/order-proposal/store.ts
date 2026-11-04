/**
 * Step 2 — Persist order proposals + per-order allocation config (atomic).
 * Strategy allocation % remains in AT controls (do not duplicate / reset).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomicSync } from "../../../../storage/safe-json.js";
import {
  AT_ORDER_PROPOSAL_MAX_HISTORY,
  AT_ORDER_PROPOSAL_PHASE,
  AT_ORDER_PROPOSAL_SCHEMA,
  type AtOrderProposalAllocationConfig,
  type AtOrderProposalRecord,
  type AtOrderProposalStoreFile,
} from "./types.js";

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "order-proposals.json",
  );
}

function defaultAllocationConfig(nowIso: string): AtOrderProposalAllocationConfig {
  return {
    individualOrderAllocation: null,
    allocationCurrency: "USD",
    strategyAllocationPercentSnapshot: null,
    currency: null,
    configVersion: 1,
    updatedAtUtc: nowIso,
  };
}

function normalize(raw: unknown): AtOrderProposalStoreFile {
  const nowIso = new Date().toISOString();
  const empty: AtOrderProposalStoreFile = {
    schemaVersion: AT_ORDER_PROPOSAL_SCHEMA,
    phase: AT_ORDER_PROPOSAL_PHASE,
    latestId: null,
    byIdempotencyKey: {},
    activeReservations: {},
    allocationConfig: defaultAllocationConfig(nowIso),
    history: [],
  };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? (o.history as AtOrderProposalRecord[])
      .filter((x) => x && typeof x === "object" && typeof x.proposalId === "string")
      .slice(0, AT_ORDER_PROPOSAL_MAX_HISTORY)
    : [];
  const byIdempotencyKey: Record<string, string> = {};
  if (o.byIdempotencyKey && typeof o.byIdempotencyKey === "object") {
    for (const [k, v] of Object.entries(o.byIdempotencyKey as Record<string, unknown>)) {
      if (typeof v === "string" && v) byIdempotencyKey[k] = v;
    }
  }
  for (const row of history) {
    if (row.idempotencyKey && row.proposalId && !byIdempotencyKey[row.idempotencyKey]) {
      byIdempotencyKey[row.idempotencyKey] = row.proposalId;
    }
  }
  const activeReservations: Record<string, number> = {};
  if (o.activeReservations && typeof o.activeReservations === "object") {
    for (const [k, v] of Object.entries(o.activeReservations as Record<string, unknown>)) {
      const n = Number(v);
      if (typeof k === "string" && k && Number.isFinite(n) && n > 0) activeReservations[k] = n;
    }
  }
  // Rebuild reservations from READY history when file omitted them
  for (const row of history) {
    if (
      row.lifecycle === "PROPOSAL_READY"
      && typeof row.capital?.allocatedAmount === "number"
      && row.capital.allocatedAmount > 0
      && !activeReservations[row.proposalId]
    ) {
      activeReservations[row.proposalId] = row.capital.allocatedAmount;
    }
  }
  const cfgRaw = o.allocationConfig && typeof o.allocationConfig === "object"
    ? (o.allocationConfig as Record<string, unknown>)
    : null;
  const allocationConfig: AtOrderProposalAllocationConfig = cfgRaw
    ? {
      individualOrderAllocation:
        typeof cfgRaw.individualOrderAllocation === "number"
          && Number.isFinite(cfgRaw.individualOrderAllocation)
          && cfgRaw.individualOrderAllocation > 0
          ? cfgRaw.individualOrderAllocation
          : null,
      allocationCurrency:
        typeof cfgRaw.allocationCurrency === "string" && cfgRaw.allocationCurrency.trim()
          ? cfgRaw.allocationCurrency.trim().toUpperCase()
          : "USD",
      strategyAllocationPercentSnapshot:
        typeof cfgRaw.strategyAllocationPercentSnapshot === "number"
          && Number.isFinite(cfgRaw.strategyAllocationPercentSnapshot)
          ? cfgRaw.strategyAllocationPercentSnapshot
          : null,
      currency:
        typeof cfgRaw.currency === "string" && cfgRaw.currency.trim()
          ? cfgRaw.currency.trim().toUpperCase()
          : null,
      configVersion:
        typeof cfgRaw.configVersion === "number" && Number.isFinite(cfgRaw.configVersion)
          ? Math.max(1, Math.floor(cfgRaw.configVersion))
          : 1,
      updatedAtUtc:
        typeof cfgRaw.updatedAtUtc === "string" && cfgRaw.updatedAtUtc
          ? cfgRaw.updatedAtUtc
          : nowIso,
    }
    : defaultAllocationConfig(nowIso);

  return {
    schemaVersion: AT_ORDER_PROPOSAL_SCHEMA,
    phase: AT_ORDER_PROPOSAL_PHASE,
    latestId: typeof o.latestId === "string" ? o.latestId : history[0]?.proposalId ?? null,
    byIdempotencyKey,
    activeReservations,
    allocationConfig,
    history,
  };
}

export class AtOrderProposalStore {
  private data: AtOrderProposalStoreFile;
  private readonly file: string;
  lastWriteError: string | null = null;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  getAllocationConfig(): AtOrderProposalAllocationConfig {
    return { ...this.data.allocationConfig };
  }

  updateAllocationConfig(patch: {
    individualOrderAllocation?: number | null;
    allocationCurrency?: string | null;
    strategyAllocationPercentSnapshot?: number | null;
    currency?: string | null;
  }): AtOrderProposalAllocationConfig {
    const cfg = { ...this.data.allocationConfig };
    if ("individualOrderAllocation" in patch) {
      const raw = patch.individualOrderAllocation;
      if (raw == null) {
        cfg.individualOrderAllocation = null;
      } else if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
        cfg.individualOrderAllocation = raw;
      }
    }
    if (patch.allocationCurrency != null && String(patch.allocationCurrency).trim()) {
      cfg.allocationCurrency = String(patch.allocationCurrency).trim().toUpperCase();
    }
    if ("strategyAllocationPercentSnapshot" in patch) {
      const p = patch.strategyAllocationPercentSnapshot;
      cfg.strategyAllocationPercentSnapshot =
        typeof p === "number" && Number.isFinite(p) ? p : null;
    }
    if ("currency" in patch) {
      const c = patch.currency;
      cfg.currency = c != null && String(c).trim() ? String(c).trim().toUpperCase() : null;
    }
    cfg.configVersion += 1;
    cfg.updatedAtUtc = new Date().toISOString();
    this.data.allocationConfig = cfg;
    this.persist();
    return { ...cfg };
  }

  activeReservationTotal(excludeProposalId?: string | null): number {
    let sum = 0;
    for (const [id, amount] of Object.entries(this.data.activeReservations)) {
      if (excludeProposalId && id === excludeProposalId) continue;
      if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) sum += amount;
    }
    return sum;
  }

  latest(): AtOrderProposalRecord | null {
    if (!this.data.latestId) return this.data.history[0] ?? null;
    return this.data.history.find((h) => h.proposalId === this.data.latestId)
      ?? this.data.history[0]
      ?? null;
  }

  get(id: string): AtOrderProposalRecord | null {
    return this.data.history.find((h) => h.proposalId === id) ?? null;
  }

  getByIdempotencyKey(key: string): AtOrderProposalRecord | null {
    const id = this.data.byIdempotencyKey[key];
    return id ? this.get(id) : null;
  }

  list(limit = 12): AtOrderProposalRecord[] {
    return this.data.history.slice(0, Math.max(1, Math.min(80, limit)));
  }

  /**
   * Persist a proposal. Idempotent: same idempotencyKey returns existing active/ready/blocked record.
   * PROPOSAL_READY reserves capital; blocked/rejected do not.
   */
  upsertProposal(record: AtOrderProposalRecord): {
    record: AtOrderProposalRecord;
    duplicate: boolean;
  } {
    const existingId = this.data.byIdempotencyKey[record.idempotencyKey];
    if (existingId) {
      const existing = this.get(existingId);
      if (
        existing
        && (existing.lifecycle === "PROPOSAL_READY"
          || existing.lifecycle === "BLOCKED"
          || existing.lifecycle === "CALCULATING"
          || existing.lifecycle === "VALIDATING"
          || existing.lifecycle === "RECEIVED")
      ) {
        return { record: existing, duplicate: true };
      }
      if (existing && existing.lifecycle === "PROPOSAL_READY") {
        this.releaseReservation(existing.proposalId);
      }
      if (existing) {
        existing.lifecycle = "SUPERSEDED";
        existing.updatedAtUtc = new Date().toISOString();
      }
    }

    if (record.lifecycle === "PROPOSAL_READY" && record.resultIntakeId) {
      for (const h of this.data.history) {
        if (
          h.proposalId !== record.proposalId
          && h.resultIntakeId === record.resultIntakeId
          && h.lifecycle === "PROPOSAL_READY"
        ) {
          this.releaseReservation(h.proposalId);
          h.lifecycle = "SUPERSEDED";
          h.updatedAtUtc = new Date().toISOString();
        }
      }
    }

    this.data.history = [record, ...this.data.history.filter((h) => h.proposalId !== record.proposalId)]
      .slice(0, AT_ORDER_PROPOSAL_MAX_HISTORY);
    this.data.byIdempotencyKey[record.idempotencyKey] = record.proposalId;
    this.data.latestId = record.proposalId;

    if (
      record.lifecycle === "PROPOSAL_READY"
      && typeof record.capital.allocatedAmount === "number"
      && record.capital.allocatedAmount > 0
    ) {
      this.data.activeReservations[record.proposalId] = record.capital.allocatedAmount;
    }

    this.persist();
    return { record, duplicate: false };
  }

  releaseReservation(proposalId: string): void {
    delete this.data.activeReservations[proposalId];
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      writeJsonAtomicSync(this.file, this.data);
      this.lastWriteError = null;
    } catch (err) {
      this.lastWriteError = err instanceof Error ? err.message : String(err);
    }
  }
}

let singleton: AtOrderProposalStore | null = null;
const byRoot = new Map<string, AtOrderProposalStore>();

export function getAtOrderProposalStore(storageRoot?: string): AtOrderProposalStore {
  if (storageRoot) {
    const existing = byRoot.get(storageRoot);
    if (existing) return existing;
    const created = new AtOrderProposalStore(storageRoot);
    byRoot.set(storageRoot, created);
    return created;
  }
  if (!singleton) singleton = new AtOrderProposalStore();
  return singleton;
}

export function resetAtOrderProposalStoreForTests(): void {
  singleton = null;
  byRoot.clear();
}

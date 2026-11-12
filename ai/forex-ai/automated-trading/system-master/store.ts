/**
 * Phase 4.18F.8R — Durable System Master state (fail closed OFF on corrupt/missing).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import {
  AT_SYSTEM_MASTER_OWNED_MODULES,
  AT_SYSTEM_MASTER_SCHEMA,
  defaultSystemMasterPersisted,
  type SystemMasterModuleId,
  type SystemMasterOperationalState,
  type SystemMasterOwnerState,
  type SystemMasterPersisted,
} from "./types.js";

function filePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "system-master.json",
  );
}

const OPS = new Set<SystemMasterOperationalState>([
  "OFF",
  "STARTING",
  "ON",
  "STOPPING",
  "BLOCKED",
  "ERROR",
]);

const MODULE_SET = new Set<string>(AT_SYSTEM_MASTER_OWNED_MODULES);

function normalizeModules(raw: unknown): SystemMasterModuleId[] {
  if (!Array.isArray(raw)) return [];
  const out: SystemMasterModuleId[] = [];
  for (const item of raw) {
    const id = String(item ?? "");
    if (MODULE_SET.has(id) && !out.includes(id as SystemMasterModuleId)) {
      out.push(id as SystemMasterModuleId);
    }
  }
  return out;
}

function normalize(raw: unknown): SystemMasterPersisted {
  const d = defaultSystemMasterPersisted();
  if (!raw || typeof raw !== "object") {
    return {
      ...d,
      lastError: "Persisted System Master state missing or corrupt — defaulted OFF.",
      lastBlockerCode: "AMBIGUOUS_RECOVERY",
    };
  }
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== AT_SYSTEM_MASTER_SCHEMA) {
    return {
      ...d,
      lastError: "System Master schema mismatch — defaulted OFF.",
      lastBlockerCode: "AMBIGUOUS_RECOVERY",
    };
  }
  const ver = Number(o.stateVersion);
  const ownerState: SystemMasterOwnerState = o.ownerState === "ON" || o.masterEnabled === true ? "ON" : "OFF";
  const operational = String(o.operationalState ?? "") as SystemMasterOperationalState;
  // Never silently invent ON operational without owner intent.
  let operationalState: SystemMasterOperationalState = OPS.has(operational) ? operational : "OFF";
  if (ownerState === "OFF") {
    if (operationalState === "ON" || operationalState === "STARTING" || operationalState === "BLOCKED") {
      operationalState = "OFF";
    }
  }
  const genRaw = Number(o.analysisGeneration);
  return {
    ...d,
    stateVersion: Number.isFinite(ver) && ver >= 1 ? Math.floor(ver) : 1,
    masterEnabled: ownerState === "ON",
    ownerState,
    operationalState,
    changedAtUtc: typeof o.changedAtUtc === "string" ? o.changedAtUtc : d.changedAtUtc,
    changedBy: typeof o.changedBy === "string" ? o.changedBy.slice(0, 64) : "system",
    lastStartAtUtc: typeof o.lastStartAtUtc === "string" ? o.lastStartAtUtc : null,
    lastStopAtUtc: typeof o.lastStopAtUtc === "string" ? o.lastStopAtUtc : null,
    activeModules: ownerState === "ON" ? normalizeModules(o.activeModules) : [],
    blockedModules: normalizeModules(o.blockedModules),
    lastError: typeof o.lastError === "string" ? o.lastError.slice(0, 240) : null,
    lastBlockerCode: typeof o.lastBlockerCode === "string" ? o.lastBlockerCode.slice(0, 80) : null,
    analysisGeneration: Number.isFinite(genRaw) && genRaw >= 0 ? Math.floor(genRaw) : 0,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    brokerExecution: "DISABLED",
  };
}

function bumpGenerationOnOff(
  prev: SystemMasterPersisted,
  next: SystemMasterPersisted,
): SystemMasterPersisted {
  const turningOff =
    (prev.ownerState === "ON" || prev.masterEnabled === true)
    && (next.ownerState === "OFF" || next.masterEnabled === false);
  if (!turningOff) return next;
  const prevGen = Number.isFinite(prev.analysisGeneration) ? Math.max(0, Math.floor(prev.analysisGeneration)) : 0;
  return {
    ...next,
    analysisGeneration: prevGen + 1,
  };
}

export class AtSystemMasterStore {
  private data: SystemMasterPersisted;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = filePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
    this.data.placesOrders = false;
    this.data.acceptsForExecution = false;
    this.data.mutatesBroker = false;
    this.data.brokerExecution = "DISABLED";
  }

  get(): SystemMasterPersisted {
    return {
      ...this.data,
      activeModules: [...this.data.activeModules],
      blockedModules: [...this.data.blockedModules],
    };
  }

  getAnalysisGeneration(): number {
    return Number.isFinite(this.data.analysisGeneration)
      ? Math.max(0, Math.floor(this.data.analysisGeneration))
      : 0;
  }

  async compareAndSet(
    expectedVersion: number,
    mutator: (prev: SystemMasterPersisted) => SystemMasterPersisted,
  ): Promise<SystemMasterPersisted | null> {
    if (this.data.stateVersion !== expectedVersion) return null;
    const prev = {
      ...this.data,
      activeModules: [...this.data.activeModules],
      blockedModules: [...this.data.blockedModules],
    };
    let next = mutator(prev);
    next = bumpGenerationOnOff(prev, next);
    next.schemaVersion = AT_SYSTEM_MASTER_SCHEMA;
    next.phase = "4.18F.8R";
    next.stateVersion = this.data.stateVersion + 1;
    next.placesOrders = false;
    next.acceptsForExecution = false;
    next.mutatesBroker = false;
    next.brokerExecution = "DISABLED";
    next.changedAtUtc = new Date().toISOString();
    if (!Number.isFinite(next.analysisGeneration) || next.analysisGeneration < 0) {
      next.analysisGeneration = prev.analysisGeneration ?? 0;
    }
    this.data = next;
    await writeJsonAtomic(this.file, this.data);
    return this.get();
  }

  async forceSet(mutator: (prev: SystemMasterPersisted) => SystemMasterPersisted): Promise<SystemMasterPersisted> {
    const result = await this.compareAndSet(this.data.stateVersion, mutator);
    if (!result) {
      const again = await this.compareAndSet(this.data.stateVersion, mutator);
      if (!again) throw new Error("SYSTEM_MASTER_CAS_FAILED");
      return again;
    }
    return result;
  }
}

let singleton: AtSystemMasterStore | null = null;

export function getAtSystemMasterStore(storageRoot?: string): AtSystemMasterStore {
  if (storageRoot) return new AtSystemMasterStore(storageRoot);
  if (!singleton) singleton = new AtSystemMasterStore();
  return singleton;
}

export function resetAtSystemMasterStoreForTests(): void {
  singleton = null;
}

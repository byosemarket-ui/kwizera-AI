/**
 * Phase 57.1 — Durable automation control state (fail closed on corrupt/missing).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import {
  AT_AUTOMATION_CONTROL_SCHEMA,
  defaultAutomationControlPersisted,
  type AutomationControlPersisted,
  type AutomationLifecycleState,
  type AutomationRequestedMode,
  type AutomationBlockReasonCode,
} from "./types.js";

function filePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "automation-control.json",
  );
}

const LIFECYCLES = new Set<AutomationLifecycleState>([
  "OFF",
  "STARTING",
  "MONITORING",
  "STOPPING",
  "BLOCKED",
  "ERROR",
]);

function normalize(raw: unknown): AutomationControlPersisted {
  const d = defaultAutomationControlPersisted();
  if (!raw || typeof raw !== "object") {
    // Missing/corrupt → fail closed OFF
    return { ...d, reasonCode: "AMBIGUOUS_RECOVERY", reasonMessage: "Persisted automation state missing or corrupt — defaulted OFF." };
  }
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== AT_AUTOMATION_CONTROL_SCHEMA) {
    return {
      ...d,
      reasonCode: "AMBIGUOUS_RECOVERY",
      reasonMessage: "Automation control schema mismatch — defaulted OFF.",
    };
  }
  const ver = Number(o.stateVersion);
  const lifecycle = String(o.lifecycle ?? "") as AutomationLifecycleState;
  const requested = o.requestedMode === "ON" ? "ON" : "OFF";
  return {
    ...d,
    stateVersion: Number.isFinite(ver) && ver >= 1 ? Math.floor(ver) : 1,
    requestedMode: requested as AutomationRequestedMode,
    lifecycle: LIFECYCLES.has(lifecycle) ? lifecycle : "OFF",
    reasonCode: (typeof o.reasonCode === "string" ? o.reasonCode : "NONE") as AutomationBlockReasonCode,
    reasonMessage: typeof o.reasonMessage === "string" ? o.reasonMessage.slice(0, 240) : null,
    lastChangedAtUtc: typeof o.lastChangedAtUtc === "string" ? o.lastChangedAtUtc : d.lastChangedAtUtc,
    lastOperatorHint: typeof o.lastOperatorHint === "string" ? o.lastOperatorHint.slice(0, 64) : "system",
    entryGenerationEnabled: false,
    placesOrders: false,
    acceptsForExecution: false,
    brokerExecution: "DISABLED",
    monitoringDesired: Boolean(o.monitoringDesired) && requested === "ON",
    lastMonitoringAtUtc: typeof o.lastMonitoringAtUtc === "string" ? o.lastMonitoringAtUtc : null,
  };
}

export class AtAutomationControlStore {
  private data: AutomationControlPersisted;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = filePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const loaded = readJsonSafeSync(this.file, null).value;
    this.data = normalize(loaded);
    // Never resume entry generation across restart.
    this.data.entryGenerationEnabled = false;
    this.data.placesOrders = false;
    this.data.acceptsForExecution = false;
    this.data.brokerExecution = "DISABLED";
  }

  get(): AutomationControlPersisted {
    return { ...this.data };
  }

  /**
   * Compare-and-set update. Returns null if expectedVersion mismatches (stale).
   */
  async compareAndSet(
    expectedVersion: number,
    mutator: (prev: AutomationControlPersisted) => AutomationControlPersisted,
  ): Promise<AutomationControlPersisted | null> {
    if (this.data.stateVersion !== expectedVersion) return null;
    const next = mutator({ ...this.data });
    next.schemaVersion = AT_AUTOMATION_CONTROL_SCHEMA;
    next.phase = "57.1";
    next.stateVersion = this.data.stateVersion + 1;
    next.entryGenerationEnabled = false;
    next.placesOrders = false;
    next.acceptsForExecution = false;
    next.brokerExecution = "DISABLED";
    next.lastChangedAtUtc = new Date().toISOString();
    this.data = next;
    await writeJsonAtomic(this.file, this.data);
    return { ...this.data };
  }

  async forceSet(mutator: (prev: AutomationControlPersisted) => AutomationControlPersisted): Promise<AutomationControlPersisted> {
    const cur = this.data.stateVersion;
    const result = await this.compareAndSet(cur, mutator);
    if (!result) {
      // Rare race — retry once on current version.
      const again = await this.compareAndSet(this.data.stateVersion, mutator);
      if (!again) throw new Error("AUTOMATION_CONTROL_CAS_FAILED");
      return again;
    }
    return result;
  }
}

let singleton: AtAutomationControlStore | null = null;

export function getAtAutomationControlStore(storageRoot?: string): AtAutomationControlStore {
  if (storageRoot) return new AtAutomationControlStore(storageRoot);
  if (!singleton) singleton = new AtAutomationControlStore();
  return singleton;
}

export function resetAtAutomationControlStoreForTests(): void {
  singleton = null;
}

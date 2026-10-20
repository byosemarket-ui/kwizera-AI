/**
 * Phase 56.2 — Persist latest simulation drafts (not order-intent lifecycle).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import { normalizeSimRiskPolicy } from "./engine.js";
import {
  AT_SIM_RISK_PHASE,
  AT_SIM_RISK_SCHEMA,
  defaultSimRiskPolicy,
  type AtSimDraftResult,
  type AtSimRiskPolicy,
} from "./types.js";

const MAX_HISTORY = 20;

interface StoreFile {
  schemaVersion: typeof AT_SIM_RISK_SCHEMA;
  phase: typeof AT_SIM_RISK_PHASE;
  policy: AtSimRiskPolicy;
  latestId: string | null;
  history: AtSimDraftResult[];
}

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "simulation-drafts.json",
  );
}

function normalize(raw: unknown): StoreFile {
  const defaults: StoreFile = {
    schemaVersion: AT_SIM_RISK_SCHEMA,
    phase: AT_SIM_RISK_PHASE,
    policy: defaultSimRiskPolicy(),
    latestId: null,
    history: [],
  };
  if (!raw || typeof raw !== "object") return defaults;
  const o = raw as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? (o.history as AtSimDraftResult[])
      .filter((x) => x && typeof x === "object" && typeof x.draftId === "string")
      .slice(0, MAX_HISTORY)
    : [];
  return {
    schemaVersion: AT_SIM_RISK_SCHEMA,
    phase: AT_SIM_RISK_PHASE,
    policy: normalizeSimRiskPolicy(o.policy ?? defaults.policy),
    latestId: typeof o.latestId === "string" ? o.latestId : history[0]?.draftId ?? null,
    history,
  };
}

export class AtSimRiskStore {
  private data: StoreFile;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  getPolicy(): AtSimRiskPolicy {
    return { ...this.data.policy };
  }

  async setPolicy(policy: AtSimRiskPolicy): Promise<AtSimRiskPolicy> {
    this.data = {
      ...this.data,
      schemaVersion: AT_SIM_RISK_SCHEMA,
      phase: AT_SIM_RISK_PHASE,
      policy: normalizeSimRiskPolicy(policy),
    };
    await writeJsonAtomic(this.file, this.data);
    return this.getPolicy();
  }

  getLatest(): AtSimDraftResult | null {
    const id = this.data.latestId;
    if (!id) return this.data.history[0] ?? null;
    return this.data.history.find((h) => h.draftId === id) ?? this.data.history[0] ?? null;
  }

  listHistory(limit = 12): AtSimDraftResult[] {
    return this.data.history.slice(0, Math.max(1, Math.min(MAX_HISTORY, limit)));
  }

  historyCount(): number {
    return this.data.history.length;
  }

  async append(result: AtSimDraftResult): Promise<AtSimDraftResult> {
    const history = [result, ...this.data.history.filter((h) => h.draftId !== result.draftId)]
      .slice(0, MAX_HISTORY);
    this.data = {
      ...this.data,
      schemaVersion: AT_SIM_RISK_SCHEMA,
      phase: AT_SIM_RISK_PHASE,
      latestId: result.draftId,
      history,
    };
    await writeJsonAtomic(this.file, this.data);
    return result;
  }
}

let storeSingleton: AtSimRiskStore | null = null;

export function getAtSimRiskStore(storageRoot?: string): AtSimRiskStore {
  if (storageRoot) return new AtSimRiskStore(storageRoot);
  if (!storeSingleton) storeSingleton = new AtSimRiskStore();
  return storeSingleton;
}

export function resetAtSimRiskStoreForTests(): void {
  storeSingleton = null;
}

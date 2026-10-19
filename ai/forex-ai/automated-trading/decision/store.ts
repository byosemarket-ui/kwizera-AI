/**
 * Phase 54 — Persist decision history + policy (no secrets).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import { normalizeDecisionPolicy } from "./policy.js";
import {
  AT_DECISION_PHASE,
  AT_DECISION_SCHEMA,
  defaultDecisionPolicy,
  type AtDecisionPolicy,
  type AtDecisionResult,
} from "./types.js";

const MAX_HISTORY = 40;

interface StoreFile {
  schemaVersion: typeof AT_DECISION_SCHEMA;
  phase: typeof AT_DECISION_PHASE;
  policy: AtDecisionPolicy;
  latestId: string | null;
  history: AtDecisionResult[];
}

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "trading-decisions.json",
  );
}

function normalize(raw: unknown): StoreFile {
  const defaults: StoreFile = {
    schemaVersion: AT_DECISION_SCHEMA,
    phase: AT_DECISION_PHASE,
    policy: defaultDecisionPolicy(),
    latestId: null,
    history: [],
  };
  if (!raw || typeof raw !== "object") return defaults;
  const o = raw as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? (o.history as AtDecisionResult[])
      .filter((x) => x && typeof x === "object" && typeof x.decisionId === "string")
      .slice(0, MAX_HISTORY)
    : [];
  return {
    schemaVersion: AT_DECISION_SCHEMA,
    phase: AT_DECISION_PHASE,
    policy: normalizeDecisionPolicy(o.policy ?? defaults.policy),
    latestId: typeof o.latestId === "string" ? o.latestId : history[0]?.decisionId ?? null,
    history,
  };
}

export class AtDecisionStore {
  private data: StoreFile;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  getPolicy(): AtDecisionPolicy {
    return { ...this.data.policy };
  }

  async setPolicy(policy: AtDecisionPolicy): Promise<AtDecisionPolicy> {
    this.data = {
      ...this.data,
      schemaVersion: AT_DECISION_SCHEMA,
      phase: AT_DECISION_PHASE,
      policy: normalizeDecisionPolicy(policy),
    };
    await writeJsonAtomic(this.file, this.data);
    return this.getPolicy();
  }

  latest(): AtDecisionResult | null {
    if (!this.data.latestId) return this.data.history[0] ?? null;
    return this.data.history.find((h) => h.decisionId === this.data.latestId)
      ?? this.data.history[0]
      ?? null;
  }

  get(id: string): AtDecisionResult | null {
    return this.data.history.find((h) => h.decisionId === id) ?? null;
  }

  list(limit = 12): AtDecisionResult[] {
    const n = Math.max(1, Math.min(MAX_HISTORY, Math.floor(limit)));
    return this.data.history.slice(0, n);
  }

  count(): number {
    return this.data.history.length;
  }

  async save(result: AtDecisionResult): Promise<void> {
    const next = [result, ...this.data.history.filter((h) => h.decisionId !== result.decisionId)]
      .slice(0, MAX_HISTORY);
    this.data = {
      schemaVersion: AT_DECISION_SCHEMA,
      phase: AT_DECISION_PHASE,
      policy: this.data.policy,
      latestId: result.decisionId,
      history: next,
    };
    await writeJsonAtomic(this.file, this.data);
  }
}

let singleton: AtDecisionStore | null = null;

export function getAtDecisionStore(storageRoot?: string): AtDecisionStore {
  if (storageRoot) return new AtDecisionStore(storageRoot);
  if (!singleton) singleton = new AtDecisionStore();
  return singleton;
}

export function resetAtDecisionStoreForTests(): void {
  singleton = null;
}

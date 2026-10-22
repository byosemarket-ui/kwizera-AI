/**
 * Phase 57.0 — Durable broker-intent persistence (never broker mutation).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import type { BrokerIntentRecord } from "./types.js";
import { BROKER_INTENT_SCHEMA } from "./types.js";

const MAX = 40;

interface FileShape {
  schemaVersion: typeof BROKER_INTENT_SCHEMA;
  intents: BrokerIntentRecord[];
}

function filePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "broker-intents.json",
  );
}

function normalize(raw: unknown): FileShape {
  const empty: FileShape = { schemaVersion: BROKER_INTENT_SCHEMA, intents: [] };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const intents = Array.isArray(o.intents)
    ? (o.intents as BrokerIntentRecord[])
      .filter((p) => p && typeof p === "object" && typeof p.intentId === "string")
      .slice(0, MAX)
    : [];
  return { schemaVersion: BROKER_INTENT_SCHEMA, intents };
}

export class AtBrokerIntentStore {
  private data: FileShape;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = filePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  list(limit = 20): BrokerIntentRecord[] {
    return this.data.intents.slice(0, Math.max(1, Math.min(limit, MAX)));
  }

  get(intentId: string): BrokerIntentRecord | null {
    return this.data.intents.find((p) => p.intentId === intentId) ?? null;
  }

  findByIdempotencyKey(key: string): BrokerIntentRecord | null {
    const k = String(key ?? "").trim();
    if (!k) return null;
    return this.data.intents.find((p) => p.idempotencyKey === k) ?? null;
  }

  async append(intent: BrokerIntentRecord): Promise<BrokerIntentRecord> {
    // Idempotent: same key returns existing without duplicating.
    const existing = this.findByIdempotencyKey(intent.idempotencyKey);
    if (existing) return existing;
    this.data.intents.unshift(intent);
    this.data.intents = this.data.intents.slice(0, MAX);
    await writeJsonAtomic(this.file, this.data);
    return intent;
  }
}

let singleton: AtBrokerIntentStore | null = null;

export function getAtBrokerIntentStore(storageRoot?: string): AtBrokerIntentStore {
  if (storageRoot) return new AtBrokerIntentStore(storageRoot);
  if (!singleton) singleton = new AtBrokerIntentStore();
  return singleton;
}

export function resetAtBrokerIntentStoreForTests(): void {
  singleton = null;
}

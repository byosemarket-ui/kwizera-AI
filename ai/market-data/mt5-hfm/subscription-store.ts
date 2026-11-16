/**
 * STEP 2B — bounded file persistence for HFM subscriptions + LKG references.
 * Atomic writes; never persists every tick indefinitely.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { HfmCanonicalQuote } from "./quote-types.js";
import type { HfmRecoveryState, HfmSubscriptionRecord } from "./subscription-types.js";
import { HFM_SUB_ENVIRONMENT, HFM_SUB_PROVIDER } from "./subscription-types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveHfmSubscriptionDir(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "subscriptions");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmp, filePath);
}

export interface HfmPersistedLkgRef {
  symbol: string;
  provider: typeof HFM_SUB_PROVIDER;
  environment: typeof HFM_SUB_ENVIRONMENT;
  bid: number | null;
  ask: number | null;
  last: number | null;
  spread: number | null;
  quoteTimestamp: number | null;
  receivedAt: string;
  sequence: number | null;
  status: string;
  /** Persisted quotes must never be treated as LIVE on restore. */
  restoredAsStale: true;
}

export interface HfmSubscriptionPersistPayload {
  provider: typeof HFM_SUB_PROVIDER;
  environment: typeof HFM_SUB_ENVIRONMENT;
  updatedAt: string;
  subscriptions: HfmSubscriptionRecord[];
  lastKnownGood: HfmPersistedLkgRef[];
  recovery: HfmRecoveryState | null;
}

export class HfmSubscriptionStore {
  readonly dir: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.dir = resolveHfmSubscriptionDir(storageRoot);
  }

  private statePath(): string {
    return path.join(this.dir, "subscriptions.json");
  }

  async load(): Promise<HfmSubscriptionPersistPayload | null> {
    try {
      const raw = await fs.readFile(this.statePath(), "utf8");
      const parsed = JSON.parse(raw) as HfmSubscriptionPersistPayload;
      if (parsed.provider !== HFM_SUB_PROVIDER || parsed.environment !== HFM_SUB_ENVIRONMENT) {
        return null;
      }
      if (!Array.isArray(parsed.subscriptions)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async save(payload: HfmSubscriptionPersistPayload): Promise<void> {
    await atomicWriteJson(this.statePath(), {
      ...payload,
      provider: HFM_SUB_PROVIDER,
      environment: HFM_SUB_ENVIRONMENT,
      updatedAt: new Date().toISOString(),
    });
  }

  static lkgFromQuote(q: HfmCanonicalQuote): HfmPersistedLkgRef {
    return {
      symbol: q.symbol,
      provider: HFM_SUB_PROVIDER,
      environment: HFM_SUB_ENVIRONMENT,
      bid: q.bid,
      ask: q.ask,
      last: q.last,
      spread: q.spread,
      quoteTimestamp: q.quoteTimestamp,
      receivedAt: q.receivedAt,
      sequence: q.sequence,
      status: q.status,
      restoredAsStale: true,
    };
  }
}

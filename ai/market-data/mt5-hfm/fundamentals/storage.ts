import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { HFM_FUNDAMENTALS_RETENTION_DAYS } from "./contracts.js";
import type { HfmEconomicEvent, HfmFundamentalsPackage, HfmFundamentalsProviderState } from "./types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveHfmFundamentalsDir(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "fundamentals");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWrite(filePath: string, data: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmp, data, "utf8");
  await fs.rename(tmp, filePath);
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._:-]+/g, "_").slice(0, 180);
}

export class HfmFundamentalsStorage {
  readonly root: string;
  readonly eventsDir: string;
  readonly revisionsDir: string;
  readonly indexesDir: string;
  readonly snapshotsDir: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.root = resolveHfmFundamentalsDir(storageRoot);
    this.eventsDir = path.join(this.root, "calendar", "events");
    this.revisionsDir = path.join(this.root, "calendar", "revisions");
    this.indexesDir = path.join(this.root, "calendar", "indexes");
    this.snapshotsDir = path.join(this.root, "snapshots");
  }

  async ensureReady(): Promise<void> {
    await ensureDir(this.eventsDir);
    await ensureDir(this.revisionsDir);
    await ensureDir(this.indexesDir);
    await ensureDir(this.snapshotsDir);
  }

  providerStatePath(): string {
    return path.join(this.root, "provider-state.json");
  }

  refreshLockPath(): string {
    return path.join(this.root, "refresh-lock.json");
  }

  eventPath(eventId: string): string {
    return path.join(this.eventsDir, `${safeId(eventId)}.json`);
  }

  snapshotPath(snapshotId: string): string {
    return path.join(this.snapshotsDir, `${safeId(snapshotId)}.json`);
  }

  async saveProviderState(state: HfmFundamentalsProviderState): Promise<void> {
    await this.ensureReady();
    await atomicWrite(this.providerStatePath(), `${JSON.stringify(state, null, 2)}\n`);
  }

  async loadProviderState(): Promise<HfmFundamentalsProviderState | null> {
    try {
      const raw = await fs.readFile(this.providerStatePath(), "utf8");
      return JSON.parse(raw) as HfmFundamentalsProviderState;
    } catch {
      return null;
    }
  }

  async saveEvent(event: HfmEconomicEvent): Promise<void> {
    await this.ensureReady();
    await atomicWrite(this.eventPath(event.eventId), `${JSON.stringify(event, null, 2)}\n`);
  }

  async saveEvents(events: HfmEconomicEvent[]): Promise<void> {
    for (const e of events) {
      await this.saveEvent(e);
    }
    const index = {
      updatedAtUtc: new Date().toISOString(),
      count: events.length,
      eventIds: events.map((e) => e.eventId),
    };
    await atomicWrite(
      path.join(this.indexesDir, "latest.json"),
      `${JSON.stringify(index, null, 2)}\n`,
    );
  }

  async loadEvent(eventId: string): Promise<HfmEconomicEvent | null> {
    try {
      const raw = await fs.readFile(this.eventPath(eventId), "utf8");
      return JSON.parse(raw) as HfmEconomicEvent;
    } catch {
      return null;
    }
  }

  async loadLatestEvents(): Promise<HfmEconomicEvent[]> {
    try {
      const raw = await fs.readFile(path.join(this.indexesDir, "latest.json"), "utf8");
      const idx = JSON.parse(raw) as { eventIds?: string[] };
      const out: HfmEconomicEvent[] = [];
      for (const id of idx.eventIds ?? []) {
        const e = await this.loadEvent(id);
        if (e) out.push(e);
      }
      return out;
    } catch {
      return [];
    }
  }

  async saveSnapshotPackage(pkg: HfmFundamentalsPackage): Promise<void> {
    await this.ensureReady();
    await atomicWrite(this.snapshotPath(pkg.snapshotId), `${JSON.stringify(pkg, null, 2)}\n`);
  }

  async loadSnapshotPackage(snapshotId: string): Promise<HfmFundamentalsPackage | null> {
    try {
      const raw = await fs.readFile(this.snapshotPath(snapshotId), "utf8");
      return JSON.parse(raw) as HfmFundamentalsPackage;
    } catch {
      return null;
    }
  }

  async tryAcquireRefreshLock(holder: string, ttlMs = 120_000): Promise<boolean> {
    await this.ensureReady();
    const p = this.refreshLockPath();
    try {
      const raw = await fs.readFile(p, "utf8");
      const lock = JSON.parse(raw) as { holder?: string; untilMs?: number };
      if (lock.untilMs && lock.untilMs > Date.now() && lock.holder !== holder) {
        return false;
      }
    } catch {
      /* no lock */
    }
    await atomicWrite(
      p,
      `${JSON.stringify({ holder, untilMs: Date.now() + ttlMs, at: new Date().toISOString() }, null, 2)}\n`,
    );
    return true;
  }

  async releaseRefreshLock(holder: string): Promise<void> {
    try {
      const raw = await fs.readFile(this.refreshLockPath(), "utf8");
      const lock = JSON.parse(raw) as { holder?: string };
      if (lock.holder && lock.holder !== holder) return;
      await fs.unlink(this.refreshLockPath());
    } catch {
      /* ignore */
    }
  }

  async pruneOlderThan(days = HFM_FUNDAMENTALS_RETENTION_DAYS): Promise<number> {
    await this.ensureReady();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let removed = 0;
    const files = await fs.readdir(this.eventsDir).catch(() => [] as string[]);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const fp = path.join(this.eventsDir, f);
      try {
        const st = await fs.stat(fp);
        if (st.mtimeMs < cutoff) {
          await fs.unlink(fp);
          removed += 1;
        }
      } catch {
        /* ignore */
      }
    }
    return removed;
  }
}

let singleton: HfmFundamentalsStorage | null = null;

export function getHfmFundamentalsStorage(): HfmFundamentalsStorage {
  if (!singleton) singleton = new HfmFundamentalsStorage();
  return singleton;
}

export function __resetHfmFundamentalsStorageForTests(): void {
  singleton = null;
}

export function hashFundamentalsPackageId(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

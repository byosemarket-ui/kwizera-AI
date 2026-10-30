import fs from "node:fs";
import path from "node:path";
import type { AutoSignalRecord } from "./types.js";
import { AUTO_SIGNAL_SCHEMA } from "./types.js";

function storageRoot(): string {
  const root = process.env.KWIZERA_STORAGE_ROOT?.trim();
  return root && root.length > 0 ? root : path.join(process.cwd(), ".kwizera-storage");
}

function storePath(): string {
  return path.join(storageRoot(), "forex", "auto-engine-signals.json");
}

interface SignalFile {
  schemaVersion: typeof AUTO_SIGNAL_SCHEMA;
  signals: AutoSignalRecord[];
}

export class AutoSignalStore {
  private signals: AutoSignalRecord[] = [];
  private readonly filePath: string;

  constructor(filePath: string = storePath()) {
    this.filePath = filePath;
    this.load();
  }

  list(limit = 50): AutoSignalRecord[] {
    return this.signals.slice(-limit);
  }

  findByDedupe(dedupeKey: string): AutoSignalRecord | undefined {
    return [...this.signals].reverse().find((s) => s.dedupeKey === dedupeKey);
  }

  upsert(signal: AutoSignalRecord): void {
    const idx = this.signals.findIndex((s) => s.signalId === signal.signalId);
    if (idx >= 0) this.signals[idx] = signal;
    else this.signals.push(signal);
    if (this.signals.length > 500) this.signals = this.signals.slice(-400);
    this.persist();
  }

  markConsumed(signalId: string, atUtc: string): AutoSignalRecord | null {
    const s = this.signals.find((x) => x.signalId === signalId);
    if (!s) return null;
    s.status = "CONSUMED";
    s.consumedAtUtc = atUtc;
    this.persist();
    return s;
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const payload: SignalFile = { schemaVersion: AUTO_SIGNAL_SCHEMA, signals: this.signals };
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, this.filePath);
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as SignalFile;
      if (raw?.schemaVersion !== AUTO_SIGNAL_SCHEMA || !Array.isArray(raw.signals)) return;
      this.signals = raw.signals;
    } catch {
      this.signals = [];
    }
  }
}

let shared: AutoSignalStore | null = null;

export function getAutoSignalStore(): AutoSignalStore {
  shared ??= new AutoSignalStore();
  return shared;
}

export function resetAutoSignalStoreForTests(filePath?: string): AutoSignalStore {
  shared = new AutoSignalStore(filePath ?? path.join(process.cwd(), `.kwizera-test-signals-${Date.now()}.json`));
  return shared;
}

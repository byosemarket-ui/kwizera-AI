import fs from "node:fs";
import path from "node:path";
import type { DailyRiskSnapshot } from "./types.js";
import { DAILY_RISK_SCHEMA } from "./types.js";

function storageRoot(): string {
  const root = process.env.KWIZERA_STORAGE_ROOT?.trim();
  return root && root.length > 0 ? root : path.join(process.cwd(), ".kwizera-storage");
}

function storePath(): string {
  return path.join(storageRoot(), "forex", "auto-engine-daily-risk.json");
}

export class DailyRiskStore {
  private snapshot: DailyRiskSnapshot | null = null;
  private readonly filePath: string;

  constructor(filePath: string = storePath()) {
    this.filePath = filePath;
    this.load();
  }

  get(): DailyRiskSnapshot | null {
    return this.snapshot;
  }

  save(next: DailyRiskSnapshot): void {
    this.snapshot = next;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
    fs.renameSync(tmp, this.filePath);
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as DailyRiskSnapshot;
      if (raw?.schemaVersion !== DAILY_RISK_SCHEMA) {
        this.snapshot = null;
        return;
      }
      this.snapshot = raw;
    } catch {
      this.snapshot = null;
    }
  }
}

let shared: DailyRiskStore | null = null;

export function getDailyRiskStore(): DailyRiskStore {
  shared ??= new DailyRiskStore();
  return shared;
}

export function resetDailyRiskStoreForTests(filePath?: string): DailyRiskStore {
  shared = new DailyRiskStore(filePath ?? path.join(process.cwd(), `.kwizera-test-daily-risk-${Date.now()}.json`));
  return shared;
}

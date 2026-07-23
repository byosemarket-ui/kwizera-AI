import fs from "node:fs";
import path from "node:path";
import { RecoveryHistoryEntry } from "./types.js";

export class RecoveryHistoryStore {
  private historyPath = "";
  private entries: RecoveryHistoryEntry[] = [];

  initialize(recoveryDir: string): void {
    fs.mkdirSync(recoveryDir, { recursive: true });
    this.historyPath = path.join(recoveryDir, "recovery-history.json");
    if (fs.existsSync(this.historyPath)) {
      this.entries = JSON.parse(fs.readFileSync(this.historyPath, "utf8")) as RecoveryHistoryEntry[];
    }
  }

  append(entry: RecoveryHistoryEntry): void {
    this.entries.push(entry);
    this.persist();
  }

  getAll(): RecoveryHistoryEntry[] {
    return [...this.entries];
  }

  getSuccessRate(): number {
    if (this.entries.length === 0) return 100;
    const successful = this.entries.filter((e) => e.success).length;
    return Math.round((successful / this.entries.length) * 100);
  }

  private persist(): void {
    fs.writeFileSync(this.historyPath, JSON.stringify(this.entries, null, 2), "utf8");
  }
}

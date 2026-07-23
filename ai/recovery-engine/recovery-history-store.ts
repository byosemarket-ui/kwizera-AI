import fs from "node:fs";
import path from "node:path";
import { RecoveryHistoryRecord } from "./types.js";

export class RecoveryHistoryStore {
  private historyPath: string | null = null;
  private readonly records: RecoveryHistoryRecord[] = [];

  initialize(recoveryDirectory: string): void {
    fs.mkdirSync(recoveryDirectory, { recursive: true });
    this.historyPath = path.join(recoveryDirectory, "recovery-history.jsonl");
  }

  append(record: RecoveryHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getRecords(): ReadonlyArray<RecoveryHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getSuccessRate(): number {
    if (this.records.length === 0) return 100;
    const successes = this.records.filter((r) => r.result === "success").length;
    return Math.round((successes / this.records.length) * 100);
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }
}

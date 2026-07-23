import fs from "node:fs";
import path from "node:path";
import { HealthHistoryRecord } from "./types.js";

export class HealthHistoryStore {
  private historyPath: string | null = null;
  private readonly records: HealthHistoryRecord[] = [];

  initialize(healthDirectory: string): void {
    fs.mkdirSync(healthDirectory, { recursive: true });
    this.historyPath = path.join(healthDirectory, "health-history.jsonl");
  }

  append(record: HealthHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getRecords(): ReadonlyArray<HealthHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }

  getPerformanceTrends(): Array<{ timestamp: string; score: number }> {
    return this.records.map((r) => ({
      timestamp: r.timestamp,
      score: r.healthScore,
    }));
  }
}

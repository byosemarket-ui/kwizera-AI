import fs from "node:fs";
import path from "node:path";
import { PlanningRecord } from "./types.js";

export class PlanningHistoryStore {
  private historyPath: string | null = null;
  private readonly records: PlanningRecord[] = [];

  initialize(plansDirectory: string): void {
    fs.mkdirSync(plansDirectory, { recursive: true });
    this.historyPath = path.join(plansDirectory, "planning-history.jsonl");
  }

  append(record: PlanningRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<PlanningRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }
}

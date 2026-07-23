import fs from "node:fs";
import path from "node:path";
import { DecisionRecord } from "./types.js";

export class DecisionHistoryStore {
  private historyPath: string | null = null;
  private readonly records: DecisionRecord[] = [];

  initialize(decisionsDirectory: string): void {
    fs.mkdirSync(decisionsDirectory, { recursive: true });
    this.historyPath = path.join(decisionsDirectory, "decision-history.jsonl");
  }

  append(record: DecisionRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<DecisionRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }
}

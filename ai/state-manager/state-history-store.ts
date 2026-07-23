import fs from "node:fs";
import path from "node:path";
import { StateHistoryRecord } from "./types.js";

export class StateHistoryStore {
  private historyPath: string | null = null;
  private readonly records: StateHistoryRecord[] = [];

  initialize(stateDirectory: string): void {
    fs.mkdirSync(stateDirectory, { recursive: true });
    this.historyPath = path.join(stateDirectory, "state-history.jsonl");
  }

  append(record: StateHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getRecords(): ReadonlyArray<StateHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }
}

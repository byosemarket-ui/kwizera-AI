import fs from "node:fs";
import path from "node:path";
import { BusMessageHistoryRecord } from "./types.js";

export class MessageHistoryStore {
  private historyPath: string | null = null;
  private readonly records: BusMessageHistoryRecord[] = [];

  initialize(communicationsDirectory: string): void {
    fs.mkdirSync(communicationsDirectory, { recursive: true });
    this.historyPath = path.join(communicationsDirectory, "message-history.jsonl");
  }

  append(record: BusMessageHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getRecords(): ReadonlyArray<BusMessageHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }
}

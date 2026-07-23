import fs from "node:fs";
import path from "node:path";
import { ReasoningRecord } from "./types.js";

export class ReasoningHistoryStore {
  private historyPath: string | null = null;
  private readonly records: ReasoningRecord[] = [];

  initialize(reasoningDirectory: string): void {
    fs.mkdirSync(reasoningDirectory, { recursive: true });
    this.historyPath = path.join(reasoningDirectory, "reasoning-history.jsonl");
  }

  append(record: ReasoningRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<ReasoningRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }
}

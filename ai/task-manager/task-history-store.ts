import fs from "node:fs";
import path from "node:path";
import { TaskHistoryRecord } from "./types.js";

export class TaskHistoryStore {
  private historyPath: string | null = null;
  private readonly records: TaskHistoryRecord[] = [];

  initialize(tasksDirectory: string): void {
    fs.mkdirSync(tasksDirectory, { recursive: true });
    this.historyPath = path.join(tasksDirectory, "task-history.jsonl");
  }

  append(record: TaskHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<TaskHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }
}

import fs from "node:fs";
import path from "node:path";
import { WorkflowHistoryRecord } from "./types.js";

export class WorkflowHistoryStore {
  private historyPath: string | null = null;
  private readonly records: WorkflowHistoryRecord[] = [];

  initialize(workflowsDirectory: string): void {
    fs.mkdirSync(workflowsDirectory, { recursive: true });
    this.historyPath = path.join(workflowsDirectory, "workflow-history.jsonl");
  }

  append(record: WorkflowHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<WorkflowHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }
}

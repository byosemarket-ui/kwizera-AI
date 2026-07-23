import fs from "node:fs";
import path from "node:path";
import { WorkflowLogEntry, WorkflowLogLevel } from "./workflow-log-types.js";

export class WorkflowLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: WorkflowLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `workflow-engine-${date}.jsonl`);
  }

  log(
    level: WorkflowLogLevel,
    event: WorkflowLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: WorkflowLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      data,
    };
    this.entries.push(entry);
    if (this.logFilePath) {
      fs.appendFileSync(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");
    }
  }

  getEntries(): ReadonlyArray<WorkflowLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

import fs from "node:fs";
import path from "node:path";
import { TaskManagerLogEntry, TaskManagerLogLevel } from "./task-log-types.js";

export class TaskManagerLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: TaskManagerLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `task-manager-${date}.jsonl`);
  }

  log(
    level: TaskManagerLogLevel,
    event: TaskManagerLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: TaskManagerLogEntry = {
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

  getEntries(): ReadonlyArray<TaskManagerLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

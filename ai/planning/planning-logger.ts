import fs from "node:fs";
import path from "node:path";
import { PlanningLogEntry, PlanningLogLevel } from "./planning-log-types.js";

export class PlanningLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: PlanningLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `planning-engine-${date}.jsonl`);
  }

  log(
    level: PlanningLogLevel,
    event: PlanningLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: PlanningLogEntry = {
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

  getEntries(): ReadonlyArray<PlanningLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

import fs from "node:fs";
import path from "node:path";
import {
  DecisionLogEntry,
  DecisionLogLevel,
} from "./decision-log-types.js";

export class DecisionLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: DecisionLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `decision-engine-${date}.jsonl`);
  }

  log(
    level: DecisionLogLevel,
    event: DecisionLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: DecisionLogEntry = {
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

  getEntries(): ReadonlyArray<DecisionLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

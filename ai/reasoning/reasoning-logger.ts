import fs from "node:fs";
import path from "node:path";
import { ReasoningLogEntry, ReasoningLogLevel } from "./reasoning-log-types.js";

export class ReasoningLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: ReasoningLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `reasoning-engine-${date}.jsonl`);
  }

  log(
    level: ReasoningLogLevel,
    event: ReasoningLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ReasoningLogEntry = {
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

  getEntries(): ReadonlyArray<ReasoningLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

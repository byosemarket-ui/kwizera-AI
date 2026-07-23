import fs from "node:fs";
import path from "node:path";
import { RecoveryEngineLogEntry, RecoveryEngineLogLevel } from "./recovery-log-types.js";

export class RecoveryEngineLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: RecoveryEngineLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `recovery-engine-${date}.jsonl`);
  }

  log(
    level: RecoveryEngineLogLevel,
    event: RecoveryEngineLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: RecoveryEngineLogEntry = {
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

  getEntries(): ReadonlyArray<RecoveryEngineLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

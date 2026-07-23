import fs from "node:fs";
import path from "node:path";
import { MultiStyleImageLogEntry, MultiStyleImageLogLevel } from "./multi-style-image-log-types.js";

export class MultiStyleImageLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `multi-style-image-generation-engine-${date}.jsonl`);
  }

  log(
    level: MultiStyleImageLogLevel,
    event: MultiStyleImageLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: MultiStyleImageLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      data,
    };
    if (this.logFilePath) {
      fs.appendFileSync(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");
    }
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

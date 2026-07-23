import fs from "node:fs";
import path from "node:path";
import { BackgroundLogEntry, BackgroundLogLevel } from "./background-log-types.js";

export class BackgroundLogger {
  private logFilePath: string | null = null;
  private readonly entries: BackgroundLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `background-intelligence-${date}.jsonl`);
  }

  log(
    level: BackgroundLogLevel,
    event: BackgroundLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: BackgroundLogEntry = {
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

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

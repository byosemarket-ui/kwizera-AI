import fs from "node:fs";
import path from "node:path";
import { LightingColorLogEntry, LightingColorLogLevel } from "./lighting-color-log-types.js";

export class LightingColorLogger {
  private logFilePath: string | null = null;
  private readonly entries: LightingColorLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `lighting-color-intelligence-${date}.jsonl`);
  }

  log(
    level: LightingColorLogLevel,
    event: LightingColorLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: LightingColorLogEntry = {
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

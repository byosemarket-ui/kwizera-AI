import fs from "node:fs";
import path from "node:path";
import { BrandVisualLogEntry, BrandVisualLogLevel } from "./brand-visual-log-types.js";

export class BrandVisualLogger {
  private logFilePath: string | null = null;
  private readonly entries: BrandVisualLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `brand-visual-intelligence-${date}.jsonl`);
  }

  log(
    level: BrandVisualLogLevel,
    event: BrandVisualLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: BrandVisualLogEntry = {
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

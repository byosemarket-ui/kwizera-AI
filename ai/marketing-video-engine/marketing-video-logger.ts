import fs from "node:fs";
import path from "node:path";
import { MarketingVideoLogEntry, MarketingVideoLogLevel } from "./marketing-video-log-types.js";

export class MarketingVideoLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `marketing-video-engine-${date}.jsonl`);
  }

  log(
    level: MarketingVideoLogLevel,
    event: MarketingVideoLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: MarketingVideoLogEntry = {
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

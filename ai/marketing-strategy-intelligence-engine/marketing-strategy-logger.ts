import fs from "node:fs";
import path from "node:path";
import { MarketingStrategyLogEntry, MarketingStrategyLogLevel } from "./marketing-strategy-log-types.js";

export class MarketingStrategyLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `marketing-strategy-intelligence-engine-${date}.jsonl`);
  }

  log(
    level: MarketingStrategyLogLevel,
    event: MarketingStrategyLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: MarketingStrategyLogEntry = {
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

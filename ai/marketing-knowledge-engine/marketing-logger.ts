import fs from "node:fs";
import path from "node:path";
import { MarketingKnowledgeLogEntry, MarketingKnowledgeLogLevel } from "./marketing-log-types.js";

export class MarketingKnowledgeLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `marketing-knowledge-engine-${date}.jsonl`);
  }

  log(
    level: MarketingKnowledgeLogLevel,
    event: MarketingKnowledgeLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: MarketingKnowledgeLogEntry = {
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

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

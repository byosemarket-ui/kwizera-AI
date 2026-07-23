import fs from "node:fs";
import path from "node:path";
import { TimelineIntelligenceLogEntry, TimelineIntelligenceLogLevel } from "./timeline-intelligence-log-types.js";

export class TimelineIntelligenceLogger {
  private logFilePath: string | null = null;
  private readonly entries: TimelineIntelligenceLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `timeline-intelligence-engine-${date}.jsonl`);
  }

  log(
    level: TimelineIntelligenceLogLevel,
    event: TimelineIntelligenceLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: TimelineIntelligenceLogEntry = {
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

  getEntries(): ReadonlyArray<TimelineIntelligenceLogEntry> {
    return this.entries;
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

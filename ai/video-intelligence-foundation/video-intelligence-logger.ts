import fs from "node:fs";
import path from "node:path";
import {
  VideoIntelligenceFoundationLogEntry,
  VideoIntelligenceFoundationLogLevel,
} from "./video-intelligence-log-types.js";

export class VideoIntelligenceFoundationLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: VideoIntelligenceFoundationLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `video-intelligence-foundation-${date}.jsonl`);
  }

  log(
    level: VideoIntelligenceFoundationLogLevel,
    event: VideoIntelligenceFoundationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: VideoIntelligenceFoundationLogEntry = {
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

  getEntries(): ReadonlyArray<VideoIntelligenceFoundationLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

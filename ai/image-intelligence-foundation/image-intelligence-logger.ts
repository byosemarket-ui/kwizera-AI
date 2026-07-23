import fs from "node:fs";
import path from "node:path";
import {
  ImageIntelligenceFoundationLogEntry,
  ImageIntelligenceFoundationLogLevel,
} from "./image-intelligence-log-types.js";

export class ImageIntelligenceFoundationLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: ImageIntelligenceFoundationLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `image-intelligence-foundation-${date}.jsonl`);
  }

  log(
    level: ImageIntelligenceFoundationLogLevel,
    event: ImageIntelligenceFoundationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ImageIntelligenceFoundationLogEntry = {
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

  getEntries(): ReadonlyArray<ImageIntelligenceFoundationLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

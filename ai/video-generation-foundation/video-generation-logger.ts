import fs from "node:fs";
import path from "node:path";
import {
  VideoGenerationFoundationLogEntry,
  VideoGenerationFoundationLogLevel,
} from "./video-generation-log-types.js";

export class VideoGenerationFoundationLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: VideoGenerationFoundationLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `video-generation-foundation-${date}.jsonl`);
  }

  log(
    level: VideoGenerationFoundationLogLevel,
    event: VideoGenerationFoundationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: VideoGenerationFoundationLogEntry = {
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

  getEntries(): ReadonlyArray<VideoGenerationFoundationLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

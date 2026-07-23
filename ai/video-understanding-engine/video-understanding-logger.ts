import fs from "node:fs";
import path from "node:path";
import { VideoUnderstandingLogEntry, VideoUnderstandingLogLevel } from "./video-understanding-log-types.js";

export class VideoUnderstandingLogger {
  private logFilePath: string | null = null;
  private readonly entries: VideoUnderstandingLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `video-understanding-engine-${date}.jsonl`);
  }

  log(
    level: VideoUnderstandingLogLevel,
    event: VideoUnderstandingLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: VideoUnderstandingLogEntry = {
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

  getEntries(): ReadonlyArray<VideoUnderstandingLogEntry> {
    return this.entries;
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

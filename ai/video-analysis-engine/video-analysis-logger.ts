import fs from "node:fs";
import path from "node:path";
import { VideoAnalysisLogEntry, VideoAnalysisLogLevel } from "./video-analysis-log-types.js";

export class VideoAnalysisLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: VideoAnalysisLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `video-analysis-engine-${date}.jsonl`);
  }

  log(
    level: VideoAnalysisLogLevel,
    event: VideoAnalysisLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: VideoAnalysisLogEntry = {
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

  getEntries(): ReadonlyArray<VideoAnalysisLogEntry> {
    return this.entries;
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

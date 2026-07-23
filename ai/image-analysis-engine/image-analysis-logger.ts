import fs from "node:fs";
import path from "node:path";
import { ImageAnalysisLogEntry, ImageAnalysisLogLevel } from "./image-analysis-log-types.js";

export class ImageAnalysisLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: ImageAnalysisLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `image-analysis-engine-${date}.jsonl`);
  }

  log(
    level: ImageAnalysisLogLevel,
    event: ImageAnalysisLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ImageAnalysisLogEntry = {
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

  getEntries(): ReadonlyArray<ImageAnalysisLogEntry> {
    return this.entries;
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

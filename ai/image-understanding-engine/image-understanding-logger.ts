import fs from "node:fs";
import path from "node:path";
import { ImageUnderstandingLogEntry, ImageUnderstandingLogLevel } from "./image-understanding-log-types.js";

export class ImageUnderstandingLogger {
  private logFilePath: string | null = null;
  private readonly entries: ImageUnderstandingLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `image-understanding-engine-${date}.jsonl`);
  }

  log(
    level: ImageUnderstandingLogLevel,
    event: ImageUnderstandingLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ImageUnderstandingLogEntry = {
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

  getEntries(): ReadonlyArray<ImageUnderstandingLogEntry> {
    return this.entries;
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

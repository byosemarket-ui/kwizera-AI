import fs from "node:fs";
import path from "node:path";
import { ObjectDetectionLogEntry, ObjectDetectionLogLevel } from "./object-detection-log-types.js";

export class ObjectDetectionLogger {
  private logFilePath: string | null = null;
  private readonly entries: ObjectDetectionLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `object-detection-intelligence-${date}.jsonl`);
  }

  log(
    level: ObjectDetectionLogLevel,
    event: ObjectDetectionLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ObjectDetectionLogEntry = {
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

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

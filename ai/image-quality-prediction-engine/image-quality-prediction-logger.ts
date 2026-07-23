import fs from "node:fs";
import path from "node:path";
import {
  ImageQualityPredictionLogEntry,
  ImageQualityPredictionLogLevel,
} from "./image-quality-prediction-log-types.js";

export class ImageQualityPredictionLogger {
  private logFilePath: string | null = null;
  private readonly entries: ImageQualityPredictionLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `image-quality-prediction-${date}.jsonl`);
  }

  log(
    level: ImageQualityPredictionLogLevel,
    event: ImageQualityPredictionLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ImageQualityPredictionLogEntry = {
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

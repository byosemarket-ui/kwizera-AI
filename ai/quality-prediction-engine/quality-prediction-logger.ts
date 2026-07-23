import fs from "node:fs";
import path from "node:path";
import { QualityPredictionLogEntry, QualityPredictionLogLevel } from "./quality-prediction-log-types.js";

export class QualityPredictionLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `quality-prediction-engine-${date}.jsonl`);
  }

  log(
    level: QualityPredictionLogLevel,
    event: QualityPredictionLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: QualityPredictionLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      data,
    };
    if (this.logFilePath) {
      fs.appendFileSync(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");
    }
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

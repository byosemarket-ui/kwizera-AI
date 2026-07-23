import fs from "node:fs";
import path from "node:path";
import {
  ImageIntelligenceHealthMonitorLogEntry,
  ImageIntelligenceHealthMonitorLogLevel,
} from "./health-log-types.js";

export class ImageIntelligenceHealthMonitorLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(
      logDirectory,
      `image-intelligence-health-monitor-engine-${date}.jsonl`
    );
  }

  log(
    level: ImageIntelligenceHealthMonitorLogLevel,
    event: ImageIntelligenceHealthMonitorLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ImageIntelligenceHealthMonitorLogEntry = {
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

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

import fs from "node:fs";
import path from "node:path";
import {
  VideoGenerationHealthMonitorLogEntry,
  VideoGenerationHealthMonitorLogLevel,
} from "./health-log-types.js";

export class VideoGenerationHealthMonitorLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `video-generation-health-monitor-engine-${date}.jsonl`);
  }

  log(
    level: VideoGenerationHealthMonitorLogLevel,
    event: VideoGenerationHealthMonitorLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: VideoGenerationHealthMonitorLogEntry = {
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

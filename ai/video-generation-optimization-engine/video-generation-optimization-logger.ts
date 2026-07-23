import fs from "node:fs";
import path from "node:path";
import {
  VideoGenerationOptimizationLogEntry,
  VideoGenerationOptimizationLogLevel,
} from "./video-generation-optimization-log-types.js";

export class VideoGenerationOptimizationLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `video-generation-optimization-engine-${date}.jsonl`);
  }

  log(
    level: VideoGenerationOptimizationLogLevel,
    event: VideoGenerationOptimizationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: VideoGenerationOptimizationLogEntry = {
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

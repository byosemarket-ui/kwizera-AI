import fs from "node:fs";
import path from "node:path";
import {
  ImageGenerationOptimizationLogEntry,
  ImageGenerationOptimizationLogLevel,
} from "./image-generation-optimization-log-types.js";

export class ImageGenerationOptimizationLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `image-generation-optimization-engine-${date}.jsonl`);
  }

  log(
    level: ImageGenerationOptimizationLogLevel,
    event: ImageGenerationOptimizationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ImageGenerationOptimizationLogEntry = {
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

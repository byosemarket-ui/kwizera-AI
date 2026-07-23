import fs from "node:fs";
import path from "node:path";
import { ImageProductionLogEntry, ImageProductionLogLevel } from "./image-production-log-types.js";

export class ImageProductionLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `image-production-engine-${date}.jsonl`);
  }

  log(
    level: ImageProductionLogLevel,
    event: ImageProductionLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ImageProductionLogEntry = {
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

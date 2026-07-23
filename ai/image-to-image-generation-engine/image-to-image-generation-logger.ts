import fs from "node:fs";
import path from "node:path";
import {
  ImageToImageGenerationLogEntry,
  ImageToImageGenerationLogLevel,
} from "./image-to-image-generation-log-types.js";

export class ImageToImageGenerationLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `image-to-image-generation-engine-${date}.jsonl`);
  }

  log(
    level: ImageToImageGenerationLogLevel,
    event: ImageToImageGenerationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ImageToImageGenerationLogEntry = {
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

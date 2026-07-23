import fs from "node:fs";
import path from "node:path";
import { ImageRenderLogEntry, ImageRenderLogLevel } from "./image-render-log-types.js";

export class ImageRenderLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `image-rendering-preparation-engine-${date}.jsonl`);
  }

  log(
    level: ImageRenderLogLevel,
    event: ImageRenderLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ImageRenderLogEntry = {
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

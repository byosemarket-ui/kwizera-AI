import fs from "node:fs";
import path from "node:path";
import {
  RenderingPreparationLogEntry,
  RenderingPreparationLogLevel,
} from "./rendering-preparation-log-types.js";

export class RenderingPreparationLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `rendering-preparation-engine-${date}.jsonl`);
  }

  log(
    level: RenderingPreparationLogLevel,
    event: RenderingPreparationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: RenderingPreparationLogEntry = {
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

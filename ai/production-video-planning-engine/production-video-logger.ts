import fs from "node:fs";
import path from "node:path";
import { ProductionVideoLogEntry, ProductionVideoLogLevel } from "./production-video-log-types.js";

export class ProductionVideoLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `production-video-planning-engine-${date}.jsonl`);
  }

  log(
    level: ProductionVideoLogLevel,
    event: ProductionVideoLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ProductionVideoLogEntry = {
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
}

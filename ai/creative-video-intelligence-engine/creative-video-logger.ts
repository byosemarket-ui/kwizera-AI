import fs from "node:fs";
import path from "node:path";
import { CreativeVideoLogEntry, CreativeVideoLogLevel } from "./creative-video-log-types.js";

export class CreativeVideoLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `creative-video-intelligence-engine-${date}.jsonl`);
  }

  log(
    level: CreativeVideoLogLevel,
    event: CreativeVideoLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: CreativeVideoLogEntry = {
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

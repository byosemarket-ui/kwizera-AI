import fs from "node:fs";
import path from "node:path";
import { AudienceLogEntry, AudienceLogLevel } from "./audience-log-types.js";

export class AudienceLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `audience-intelligence-engine-${date}.jsonl`);
  }

  log(
    level: AudienceLogLevel,
    event: AudienceLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: AudienceLogEntry = {
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

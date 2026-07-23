import fs from "node:fs";
import path from "node:path";
import { StoryboardLogEntry, StoryboardLogLevel } from "./storyboard-log-types.js";

export class StoryboardLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `storyboard-intelligence-engine-${date}.jsonl`);
  }

  log(
    level: StoryboardLogLevel,
    event: StoryboardLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: StoryboardLogEntry = {
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

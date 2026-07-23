import fs from "node:fs";
import path from "node:path";
import { AudioPlanningLogEntry, AudioPlanningLogLevel } from "./audio-planning-log-types.js";

export class AudioPlanningLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `audio-planning-engine-${date}.jsonl`);
  }

  log(
    level: AudioPlanningLogLevel,
    event: AudioPlanningLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: AudioPlanningLogEntry = {
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

import fs from "node:fs";
import path from "node:path";
import {
  AudioEnhancementRestorationLogEntry,
  AudioEnhancementRestorationLogLevel,
} from "./audio-enhancement-restoration-log-types.js";

export class AudioEnhancementRestorationLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `audio-enhancement-restoration-engine-${date}.jsonl`);
  }

  log(
    level: AudioEnhancementRestorationLogLevel,
    event: AudioEnhancementRestorationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: AudioEnhancementRestorationLogEntry = {
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

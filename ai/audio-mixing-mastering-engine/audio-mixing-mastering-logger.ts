import fs from "node:fs";
import path from "node:path";
import {
  AudioMixingMasteringLogEntry,
  AudioMixingMasteringLogLevel,
} from "./audio-mixing-mastering-log-types.js";

export class AudioMixingMasteringLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `audio-mixing-mastering-engine-${date}.jsonl`);
  }

  log(
    level: AudioMixingMasteringLogLevel,
    event: AudioMixingMasteringLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: AudioMixingMasteringLogEntry = {
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

import fs from "node:fs";
import path from "node:path";
import {
  AmbientAudioGenerationLogEntry,
  AmbientAudioGenerationLogLevel,
} from "./ambient-audio-generation-log-types.js";

export class AmbientAudioGenerationLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `ambient-audio-generation-engine-${date}.jsonl`);
  }

  log(
    level: AmbientAudioGenerationLogLevel,
    event: AmbientAudioGenerationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: AmbientAudioGenerationLogEntry = {
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

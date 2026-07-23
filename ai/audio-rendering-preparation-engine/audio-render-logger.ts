import fs from "node:fs";
import path from "node:path";
import { AudioRenderLogEntry, AudioRenderLogLevel } from "./audio-render-log-types.js";

export class AudioRenderLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `audio-rendering-preparation-engine-${date}.jsonl`);
  }

  log(
    level: AudioRenderLogLevel,
    event: AudioRenderLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: AudioRenderLogEntry = {
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

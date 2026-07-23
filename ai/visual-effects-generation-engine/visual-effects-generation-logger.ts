import fs from "node:fs";
import path from "node:path";
import {
  VisualEffectsGenerationLogEntry,
  VisualEffectsGenerationLogLevel,
} from "./visual-effects-generation-log-types.js";

export class VisualEffectsGenerationLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `visual-effects-generation-engine-${date}.jsonl`);
  }

  log(
    level: VisualEffectsGenerationLogLevel,
    event: VisualEffectsGenerationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: VisualEffectsGenerationLogEntry = {
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

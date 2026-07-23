import fs from "node:fs";
import path from "node:path";
import {
  TextToSpeechGenerationLogEntry,
  TextToSpeechGenerationLogLevel,
} from "./text-to-speech-generation-log-types.js";

export class TextToSpeechGenerationLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `text-to-speech-generation-engine-${date}.jsonl`);
  }

  log(
    level: TextToSpeechGenerationLogLevel,
    event: TextToSpeechGenerationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: TextToSpeechGenerationLogEntry = {
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

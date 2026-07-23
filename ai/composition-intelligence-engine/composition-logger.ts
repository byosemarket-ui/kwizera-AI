import fs from "node:fs";
import path from "node:path";
import { CompositionLogEntry, CompositionLogLevel } from "./composition-log-types.js";

export class CompositionLogger {
  private logFilePath: string | null = null;
  private readonly entries: CompositionLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `composition-intelligence-${date}.jsonl`);
  }

  log(
    level: CompositionLogLevel,
    event: CompositionLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: CompositionLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      data,
    };
    this.entries.push(entry);
    if (this.logFilePath) {
      fs.appendFileSync(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");
    }
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

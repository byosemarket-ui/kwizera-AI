import fs from "node:fs";
import path from "node:path";
import { MemoryIndexLogEntry, MemoryIndexLogLevel } from "./index-log-types.js";

export class MemoryIndexLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: MemoryIndexLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `memory-index-engine-${date}.jsonl`);
  }

  log(
    level: MemoryIndexLogLevel,
    event: MemoryIndexLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: MemoryIndexLogEntry = {
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

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

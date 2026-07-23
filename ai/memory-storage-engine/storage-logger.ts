import fs from "node:fs";
import path from "node:path";
import { MemoryStorageLogEntry, MemoryStorageLogLevel } from "./storage-log-types.js";

export class MemoryStorageLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: MemoryStorageLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `memory-storage-engine-${date}.jsonl`);
  }

  log(
    level: MemoryStorageLogLevel,
    event: MemoryStorageLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: MemoryStorageLogEntry = {
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

  getEntries(): ReadonlyArray<MemoryStorageLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

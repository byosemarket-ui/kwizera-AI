import fs from "node:fs";
import path from "node:path";
import { KnowledgeStorageLogEntry, KnowledgeStorageLogLevel } from "./storage-log-types.js";

export class KnowledgeStorageLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: KnowledgeStorageLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `knowledge-storage-engine-${date}.jsonl`);
  }

  log(
    level: KnowledgeStorageLogLevel,
    event: KnowledgeStorageLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: KnowledgeStorageLogEntry = {
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

  getEntries(): ReadonlyArray<KnowledgeStorageLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

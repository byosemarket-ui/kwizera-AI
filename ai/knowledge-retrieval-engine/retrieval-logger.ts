import fs from "node:fs";
import path from "node:path";
import { KnowledgeRetrievalLogEntry, KnowledgeRetrievalLogLevel } from "./retrieval-log-types.js";

export class KnowledgeRetrievalLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: KnowledgeRetrievalLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `knowledge-retrieval-engine-${date}.jsonl`);
  }

  log(
    level: KnowledgeRetrievalLogLevel,
    event: KnowledgeRetrievalLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: KnowledgeRetrievalLogEntry = {
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

  getEntries(): ReadonlyArray<KnowledgeRetrievalLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

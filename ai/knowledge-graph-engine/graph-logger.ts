import fs from "node:fs";
import path from "node:path";
import { KnowledgeGraphLogEntry, KnowledgeGraphLogLevel } from "./graph-log-types.js";

export class KnowledgeGraphLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: KnowledgeGraphLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `knowledge-graph-engine-${date}.jsonl`);
  }

  log(
    level: KnowledgeGraphLogLevel,
    event: KnowledgeGraphLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: KnowledgeGraphLogEntry = {
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

  getEntries(): ReadonlyArray<KnowledgeGraphLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

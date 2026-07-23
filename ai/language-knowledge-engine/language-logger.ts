import fs from "node:fs";
import path from "node:path";
import { LanguageKnowledgeLogEntry, LanguageKnowledgeLogLevel } from "./language-log-types.js";

export class LanguageKnowledgeLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `language-knowledge-engine-${date}.jsonl`);
  }

  log(
    level: LanguageKnowledgeLogLevel,
    event: LanguageKnowledgeLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: LanguageKnowledgeLogEntry = {
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

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

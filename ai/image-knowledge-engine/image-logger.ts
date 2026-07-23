import fs from "node:fs";
import path from "node:path";
import { ImageKnowledgeLogEntry, ImageKnowledgeLogLevel } from "./image-log-types.js";

export class ImageKnowledgeLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: ImageKnowledgeLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `image-knowledge-engine-${date}.jsonl`);
  }

  log(
    level: ImageKnowledgeLogLevel,
    event: ImageKnowledgeLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ImageKnowledgeLogEntry = {
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

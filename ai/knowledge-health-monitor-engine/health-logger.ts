import fs from "node:fs";
import path from "node:path";
import {
  KnowledgeHealthMonitorLogEntry,
  KnowledgeHealthMonitorLogLevel,
} from "./health-log-types.js";

export class KnowledgeHealthMonitorLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `knowledge-health-monitor-engine-${date}.jsonl`);
  }

  log(
    level: KnowledgeHealthMonitorLogLevel,
    event: KnowledgeHealthMonitorLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: KnowledgeHealthMonitorLogEntry = {
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

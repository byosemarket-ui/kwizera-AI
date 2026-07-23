import fs from "node:fs";
import path from "node:path";
import { EnhancementPlanningLogEntry, EnhancementPlanningLogLevel } from "./enhancement-planning-log-types.js";

export class EnhancementPlanningLogger {
  private logFilePath: string | null = null;
  private readonly entries: EnhancementPlanningLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `image-enhancement-planning-${date}.jsonl`);
  }

  log(
    level: EnhancementPlanningLogLevel,
    event: EnhancementPlanningLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: EnhancementPlanningLogEntry = {
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

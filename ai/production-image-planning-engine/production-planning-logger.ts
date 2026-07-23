import fs from "node:fs";
import path from "node:path";
import { ProductionPlanningLogEntry, ProductionPlanningLogLevel } from "./production-planning-log-types.js";

export class ProductionPlanningLogger {
  private logFilePath: string | null = null;
  private readonly entries: ProductionPlanningLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `production-image-planning-${date}.jsonl`);
  }

  log(
    level: ProductionPlanningLogLevel,
    event: ProductionPlanningLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ProductionPlanningLogEntry = {
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

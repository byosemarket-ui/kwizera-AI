import fs from "node:fs";
import path from "node:path";
import { VisualPlanningLogEntry, VisualPlanningLogLevel } from "./visual-planning-log-types.js";

export class VisualPlanningLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `visual-planning-engine-${date}.jsonl`);
  }

  log(
    level: VisualPlanningLogLevel,
    event: VisualPlanningLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: VisualPlanningLogEntry = {
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

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

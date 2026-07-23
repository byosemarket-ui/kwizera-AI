import fs from "node:fs";
import path from "node:path";
import { MotionIntelligenceLogEntry, MotionIntelligenceLogLevel } from "./motion-intelligence-log-types.js";

export class MotionIntelligenceLogger {
  private logFilePath: string | null = null;
  private readonly entries: MotionIntelligenceLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `motion-intelligence-engine-${date}.jsonl`);
  }

  log(
    level: MotionIntelligenceLogLevel,
    event: MotionIntelligenceLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: MotionIntelligenceLogEntry = {
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
}

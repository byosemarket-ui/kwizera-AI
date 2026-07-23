import fs from "node:fs";
import path from "node:path";
import { SceneDetectionLogEntry, SceneDetectionLogLevel } from "./scene-detection-log-types.js";

export class SceneDetectionLogger {
  private logFilePath: string | null = null;
  private readonly entries: SceneDetectionLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `scene-detection-intelligence-engine-${date}.jsonl`);
  }

  log(
    level: SceneDetectionLogLevel,
    event: SceneDetectionLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: SceneDetectionLogEntry = {
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

  getEntries(): ReadonlyArray<SceneDetectionLogEntry> {
    return this.entries;
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

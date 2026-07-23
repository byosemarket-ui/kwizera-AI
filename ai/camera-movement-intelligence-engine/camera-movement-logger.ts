import fs from "node:fs";
import path from "node:path";
import { CameraMovementLogEntry, CameraMovementLogLevel } from "./camera-movement-log-types.js";

export class CameraMovementLogger {
  private logFilePath: string | null = null;
  private readonly entries: CameraMovementLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `camera-movement-intelligence-engine-${date}.jsonl`);
  }

  log(
    level: CameraMovementLogLevel,
    event: CameraMovementLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: CameraMovementLogEntry = {
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

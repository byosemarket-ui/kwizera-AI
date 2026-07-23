import fs from "node:fs";
import path from "node:path";
import { VideoStyleLogEntry, VideoStyleLogLevel } from "./video-style-log-types.js";

export class VideoStyleLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `video-style-intelligence-engine-${date}.jsonl`);
  }

  log(
    level: VideoStyleLogLevel,
    event: VideoStyleLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: VideoStyleLogEntry = {
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
}

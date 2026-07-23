import fs from "node:fs";
import path from "node:path";
import { VideoEnhancementLogEntry, VideoEnhancementLogLevel } from "./video-enhancement-log-types.js";

export class VideoEnhancementLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `video-enhancement-planning-engine-${date}.jsonl`);
  }

  log(
    level: VideoEnhancementLogLevel,
    event: VideoEnhancementLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: VideoEnhancementLogEntry = {
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

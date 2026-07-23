import fs from "node:fs";
import path from "node:path";
import { BrandingDesignLogEntry, BrandingDesignLogLevel } from "./branding-design-log-types.js";

export class BrandingDesignLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `branding-design-engine-${date}.jsonl`);
  }

  log(
    level: BrandingDesignLogLevel,
    event: BrandingDesignLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: BrandingDesignLogEntry = {
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

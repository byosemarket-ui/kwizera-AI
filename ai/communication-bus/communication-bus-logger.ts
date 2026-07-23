import fs from "node:fs";
import path from "node:path";
import {
  CommunicationBusLogEntry,
  CommunicationBusLogLevel,
} from "./bus-log-types.js";

export class CommunicationBusLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: CommunicationBusLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `communication-bus-${date}.jsonl`);
  }

  log(
    level: CommunicationBusLogLevel,
    event: CommunicationBusLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: CommunicationBusLogEntry = {
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

  getEntries(): ReadonlyArray<CommunicationBusLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

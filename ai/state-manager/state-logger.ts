import fs from "node:fs";
import path from "node:path";
import { StateManagerLogEntry, StateManagerLogLevel } from "./state-log-types.js";

export class StateManagerLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: StateManagerLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `state-manager-${date}.jsonl`);
  }

  log(
    level: StateManagerLogLevel,
    event: StateManagerLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: StateManagerLogEntry = {
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

  getEntries(): ReadonlyArray<StateManagerLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }
}

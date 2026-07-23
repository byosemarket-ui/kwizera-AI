import fs from "node:fs";
import path from "node:path";
import {
  LogCategory,
  LogLevel,
  StructuredLogEntry,
} from "./types.js";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface AiCoreLoggerOptions {
  logDirectory: string;
  minLevel: LogLevel;
  correlationId?: string;
}

export class AiCoreLogger {
  private readonly entries: StructuredLogEntry[] = [];
  private minLevel: LogLevel = "info";
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private correlationId: string | undefined;
  private initialized = false;

  configure(options: AiCoreLoggerOptions): void {
    this.logDirectory = options.logDirectory;
    this.minLevel = options.minLevel;
    this.correlationId = options.correlationId;
    fs.mkdirSync(options.logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(options.logDirectory, `ai-core-${date}.jsonl`);
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }

  getEntries(): ReadonlyArray<StructuredLogEntry> {
    return this.entries;
  }

  log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      correlationId: this.correlationId,
      data,
    };

    this.entries.push(entry);

    if (this.logFilePath) {
      fs.appendFileSync(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");
    }
  }

  debug(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.log("debug", category, message, data);
  }

  info(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.log("info", category, message, data);
  }

  warn(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.log("warn", category, message, data);
  }

  error(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.log("error", category, message, data);
  }

  flush(): void {
    // appendFileSync is synchronous — nothing extra required for Step 2A
  }
}

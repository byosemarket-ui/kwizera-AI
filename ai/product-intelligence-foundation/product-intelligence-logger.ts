import fs from "node:fs";
import path from "node:path";
import {
  ProductIntelligenceFoundationLogEntry,
  ProductIntelligenceFoundationLogLevel,
} from "./product-intelligence-log-types.js";

export class ProductIntelligenceFoundationLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: ProductIntelligenceFoundationLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `product-intelligence-foundation-${date}.jsonl`);
  }

  log(
    level: ProductIntelligenceFoundationLogLevel,
    event: ProductIntelligenceFoundationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ProductIntelligenceFoundationLogEntry = {
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

  getEntries(): ReadonlyArray<ProductIntelligenceFoundationLogEntry> {
    return this.entries;
  }

  getLogDirectory(): string | null {
    return this.logDirectory;
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

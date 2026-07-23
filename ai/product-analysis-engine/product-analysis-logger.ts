import fs from "node:fs";
import path from "node:path";
import { ProductAnalysisLogEntry, ProductAnalysisLogLevel } from "./product-analysis-log-types.js";

export class ProductAnalysisLogger {
  private logDirectory: string | null = null;
  private logFilePath: string | null = null;
  private readonly entries: ProductAnalysisLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    this.logDirectory = logDirectory;
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `product-analysis-engine-${date}.jsonl`);
  }

  log(
    level: ProductAnalysisLogLevel,
    event: ProductAnalysisLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ProductAnalysisLogEntry = {
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

  getEntries(): ReadonlyArray<ProductAnalysisLogEntry> {
    return this.entries;
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

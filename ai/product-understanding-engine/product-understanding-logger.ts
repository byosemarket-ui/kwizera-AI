import fs from "node:fs";
import path from "node:path";
import { ProductUnderstandingLogEntry, ProductUnderstandingLogLevel } from "./product-understanding-log-types.js";

export class ProductUnderstandingLogger {
  private logFilePath: string | null = null;
  private readonly entries: ProductUnderstandingLogEntry[] = [];

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `product-understanding-engine-${date}.jsonl`);
  }

  log(
    level: ProductUnderstandingLogLevel,
    event: ProductUnderstandingLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ProductUnderstandingLogEntry = {
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

  getLogFilePath(): string | null {
    return this.logFilePath;
  }
}

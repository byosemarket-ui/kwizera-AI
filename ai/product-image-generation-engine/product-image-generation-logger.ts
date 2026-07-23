import fs from "node:fs";
import path from "node:path";
import {
  ProductImageGenerationLogEntry,
  ProductImageGenerationLogLevel,
} from "./product-image-generation-log-types.js";

export class ProductImageGenerationLogger {
  private logFilePath: string | null = null;

  initialize(logDirectory: string): void {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(logDirectory, `product-image-generation-engine-${date}.jsonl`);
  }

  log(
    level: ProductImageGenerationLogLevel,
    event: ProductImageGenerationLogEntry["event"],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: ProductImageGenerationLogEntry = {
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

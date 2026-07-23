import fs from "node:fs";
import path from "node:path";

export interface MemoryHistoryRecord {
  timestamp: string;
  event: string;
  category?: string;
  operation?: string;
  requesterId?: string;
  durationMs?: number;
  success: boolean;
  detail?: string;
}

export class MemoryHistoryStore {
  private historyPath: string | null = null;
  private readonly records: MemoryHistoryRecord[] = [];

  initialize(memoryDirectory: string): void {
    const historyDir = path.join(memoryDirectory, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    this.historyPath = path.join(historyDir, "memory-history.jsonl");
  }

  append(record: MemoryHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getRecords(): ReadonlyArray<MemoryHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }
}

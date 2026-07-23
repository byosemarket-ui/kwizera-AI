import fs from "node:fs";
import path from "node:path";

export interface ImageIntelligenceHistoryRecord {
  timestamp: string;
  event: string;
  category?: string;
  operation?: string;
  requesterId?: string;
  durationMs?: number;
  success: boolean;
  detail?: string;
}

export class ImageIntelligenceHistoryStore {
  private historyPath: string | null = null;
  private readonly records: ImageIntelligenceHistoryRecord[] = [];

  initialize(intelligenceDirectory: string): void {
    const historyDir = path.join(intelligenceDirectory, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    this.historyPath = path.join(historyDir, "image-intelligence-history.jsonl");
  }

  append(record: ImageIntelligenceHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getRecords(): ReadonlyArray<ImageIntelligenceHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }
}

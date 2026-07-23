import fs from "node:fs";
import path from "node:path";

export interface ProductIntelligenceHistoryRecord {
  timestamp: string;
  event: string;
  category?: string;
  operation?: string;
  requesterId?: string;
  durationMs?: number;
  success: boolean;
  detail?: string;
}

export class ProductIntelligenceHistoryStore {
  private historyPath: string | null = null;
  private readonly records: ProductIntelligenceHistoryRecord[] = [];

  initialize(intelligenceDirectory: string): void {
    const historyDir = path.join(intelligenceDirectory, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    this.historyPath = path.join(historyDir, "product-intelligence-history.jsonl");
  }

  append(record: ProductIntelligenceHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getRecords(): ReadonlyArray<ProductIntelligenceHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }
}

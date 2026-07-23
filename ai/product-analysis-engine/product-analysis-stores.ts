import fs from "node:fs";
import path from "node:path";
import { ProductAnalysisIntelligenceRecord } from "./types.js";

export class ProductAnalysisRecordStore {
  private storePath = "";
  private records = new Map<string, ProductAnalysisIntelligenceRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "product-analysis-records.json");
    if (fs.existsSync(this.storePath)) {
      const raw = fs.readFileSync(this.storePath, "utf8");
      const list = JSON.parse(raw) as ProductAnalysisIntelligenceRecord[];
      for (const record of list) {
        this.records.set(record.productId, record);
      }
    }
  }

  upsert(record: ProductAnalysisIntelligenceRecord): void {
    this.records.set(record.productId, record);
    this.persist();
  }

  get(productId: string): ProductAnalysisIntelligenceRecord | undefined {
    return this.records.get(productId);
  }

  getAll(): ProductAnalysisIntelligenceRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }
}

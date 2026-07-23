import fs from "node:fs";
import path from "node:path";
import { ProductUnderstandingRecord } from "./types.js";

export class ProductUnderstandingRecordStore {
  private storePath = "";
  private records = new Map<string, ProductUnderstandingRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "product-understanding-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ProductUnderstandingRecord[];
      for (const record of list) {
        this.records.set(record.productId, record);
      }
    }
  }

  upsert(record: ProductUnderstandingRecord): void {
    this.records.set(record.productId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(productId: string): ProductUnderstandingRecord | undefined {
    return this.records.get(productId);
  }

  getAll(): ProductUnderstandingRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

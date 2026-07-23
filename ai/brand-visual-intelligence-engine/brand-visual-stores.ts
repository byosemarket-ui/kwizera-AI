import fs from "node:fs";
import path from "node:path";
import { BrandVisualIntelligenceRecord } from "./types.js";

export class BrandVisualIntelligenceRecordStore {
  private storePath = "";
  private records = new Map<string, BrandVisualIntelligenceRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "brand-visual-intelligence-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as BrandVisualIntelligenceRecord[];
      for (const record of list) {
        this.records.set(record.imageId, record);
      }
    }
  }

  upsert(record: BrandVisualIntelligenceRecord): void {
    this.records.set(record.imageId, record);
    this.persist();
  }

  get(imageId: string): BrandVisualIntelligenceRecord | undefined {
    return this.records.get(imageId);
  }

  getAll(): BrandVisualIntelligenceRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  getByBrand(brandName: string): BrandVisualIntelligenceRecord[] {
    const q = brandName.toLowerCase();
    return this.getAll().filter((r) => r.profile.brandName.toLowerCase().includes(q));
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }
}

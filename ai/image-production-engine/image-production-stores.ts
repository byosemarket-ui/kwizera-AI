import fs from "node:fs";
import path from "node:path";
import { ImageProductionRecord } from "./types.js";

export class ImageProductionRecordStore {
  private storePath = "";
  private records = new Map<string, ImageProductionRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "image-production-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ImageProductionRecord[];
      for (const record of list) {
        this.records.set(record.imageProductionId, record);
      }
    }
  }

  upsert(record: ImageProductionRecord): void {
    this.records.set(record.imageProductionId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(imageProductionId: string): ImageProductionRecord | undefined {
    return this.records.get(imageProductionId);
  }

  getByProduct(productId: string): ImageProductionRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getByImagePlan(imagePlanId: string): ImageProductionRecord[] {
    return this.getAll().filter((r) => r.profile.imagePlanId === imagePlanId);
  }

  getAll(): ImageProductionRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

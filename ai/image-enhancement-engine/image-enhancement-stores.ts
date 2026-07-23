import fs from "node:fs";
import path from "node:path";
import { ImageEnhancementRecord } from "./types.js";

export class ImageEnhancementRecordStore {
  private storePath = "";
  private records = new Map<string, ImageEnhancementRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "image-enhancement-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ImageEnhancementRecord[];
      for (const record of list) {
        this.records.set(record.enhancementPlanId, record);
      }
    }
  }

  upsert(record: ImageEnhancementRecord): void {
    this.records.set(record.enhancementPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(enhancementPlanId: string): ImageEnhancementRecord | undefined {
    return this.records.get(enhancementPlanId);
  }

  getBySourceImage(sourceImageId: string): ImageEnhancementRecord[] {
    return this.getAll().filter((r) => r.profile.sourceImageId === sourceImageId);
  }

  getByProduct(productId: string): ImageEnhancementRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getAll(): ImageEnhancementRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

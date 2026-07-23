import fs from "node:fs";
import path from "node:path";
import { ImageEditingRecord } from "./types.js";

export class ImageEditingRecordStore {
  private storePath = "";
  private records = new Map<string, ImageEditingRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "image-editing-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ImageEditingRecord[];
      for (const record of list) {
        this.records.set(record.imageEditingPlanId, record);
      }
    }
  }

  upsert(record: ImageEditingRecord): void {
    this.records.set(record.imageEditingPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(imageEditingPlanId: string): ImageEditingRecord | undefined {
    return this.records.get(imageEditingPlanId);
  }

  getBySourceImage(sourceImageId: string): ImageEditingRecord[] {
    return this.getAll().filter((r) => r.profile.sourceImageId === sourceImageId);
  }

  getByProduct(productId: string): ImageEditingRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getAll(): ImageEditingRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

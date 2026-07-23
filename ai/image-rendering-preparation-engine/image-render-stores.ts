import fs from "node:fs";
import path from "node:path";
import { ImageRenderRecord } from "./types.js";

export class ImageRenderRecordStore {
  private storePath = "";
  private records = new Map<string, ImageRenderRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "image-render-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ImageRenderRecord[];
      for (const record of list) {
        this.records.set(record.imageRenderPlanId, record);
      }
    }
  }

  upsert(record: ImageRenderRecord): void {
    this.records.set(record.imageRenderPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(imageRenderPlanId: string): ImageRenderRecord | undefined {
    return this.records.get(imageRenderPlanId);
  }

  getByProduction(productionId: string): ImageRenderRecord[] {
    return this.getAll().filter((r) => r.profile.productionId === productionId);
  }

  getByProduct(productId: string): ImageRenderRecord[] {
    return this.getAll().filter((r) => r.relationships.products.includes(productId));
  }

  getAll(): ImageRenderRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

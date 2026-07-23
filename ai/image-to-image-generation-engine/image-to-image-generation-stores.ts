import fs from "node:fs";
import path from "node:path";
import { ImageToImageGenerationRecord } from "./types.js";

export class ImageToImageGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, ImageToImageGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "image-to-image-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ImageToImageGenerationRecord[];
      for (const record of list) {
        this.records.set(record.transformationPlanId, record);
      }
    }
  }

  upsert(record: ImageToImageGenerationRecord): void {
    this.records.set(record.transformationPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(transformationPlanId: string): ImageToImageGenerationRecord | undefined {
    return this.records.get(transformationPlanId);
  }

  getBySourceImage(sourceImageId: string): ImageToImageGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.sourceImageId === sourceImageId);
  }

  getByProduct(productId: string): ImageToImageGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getByProject(projectId: string): ImageToImageGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.projectId === projectId);
  }

  getAll(): ImageToImageGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

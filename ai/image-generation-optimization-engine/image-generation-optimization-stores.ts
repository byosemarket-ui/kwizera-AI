import fs from "node:fs";
import path from "node:path";
import { ImageGenerationOptimizationRecord } from "./types.js";

export class ImageGenerationOptimizationRecordStore {
  private storePath = "";
  private records = new Map<string, ImageGenerationOptimizationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "image-generation-optimization-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ImageGenerationOptimizationRecord[];
      for (const record of list) {
        this.records.set(record.optimizationId, record);
      }
    }
  }

  upsert(record: ImageGenerationOptimizationRecord): void {
    this.records.set(record.optimizationId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(optimizationId: string): ImageGenerationOptimizationRecord | undefined {
    return this.records.get(optimizationId);
  }

  getByProduct(productId: string): ImageGenerationOptimizationRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getByValidation(validationId: string): ImageGenerationOptimizationRecord[] {
    return this.getAll().filter((r) => r.profile.validationId === validationId);
  }

  getAll(): ImageGenerationOptimizationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

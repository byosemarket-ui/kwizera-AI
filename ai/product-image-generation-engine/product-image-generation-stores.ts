import fs from "node:fs";
import path from "node:path";
import { ProductImageGenerationRecord } from "./types.js";

export class ProductImageGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, ProductImageGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "product-image-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ProductImageGenerationRecord[];
      for (const record of list) {
        this.records.set(record.productImagePlanId, record);
      }
    }
  }

  upsert(record: ProductImageGenerationRecord): void {
    this.records.set(record.productImagePlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(productImagePlanId: string): ProductImageGenerationRecord | undefined {
    return this.records.get(productImagePlanId);
  }

  getByProduct(productId: string): ProductImageGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getByProject(projectId: string): ProductImageGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.projectId === projectId);
  }

  getByCategory(productCategory: string): ProductImageGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.productCategory === productCategory);
  }

  getAll(): ProductImageGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

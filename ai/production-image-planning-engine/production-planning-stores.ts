import fs from "node:fs";
import path from "node:path";
import { ProductionImagePlanningRecord } from "./types.js";

export class ProductionImagePlanningRecordStore {
  private storePath = "";
  private records = new Map<string, ProductionImagePlanningRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "production-image-planning-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ProductionImagePlanningRecord[];
      for (const record of list) {
        this.records.set(record.imageId, record);
      }
    }
  }

  upsert(record: ProductionImagePlanningRecord): void {
    this.records.set(record.imageId, record);
    this.persist();
  }

  get(imageId: string): ProductionImagePlanningRecord | undefined {
    return this.records.get(imageId);
  }

  getAll(): ProductionImagePlanningRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }
}

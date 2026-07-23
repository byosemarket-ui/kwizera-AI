import fs from "node:fs";
import path from "node:path";
import { ImageEnhancementPlanningRecord } from "./types.js";

export class ImageEnhancementPlanningRecordStore {
  private storePath = "";
  private records = new Map<string, ImageEnhancementPlanningRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "image-enhancement-planning-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ImageEnhancementPlanningRecord[];
      for (const record of list) {
        this.records.set(record.imageId, record);
      }
    }
  }

  upsert(record: ImageEnhancementPlanningRecord): void {
    this.records.set(record.imageId, record);
    this.persist();
  }

  get(imageId: string): ImageEnhancementPlanningRecord | undefined {
    return this.records.get(imageId);
  }

  getAll(): ImageEnhancementPlanningRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }
}

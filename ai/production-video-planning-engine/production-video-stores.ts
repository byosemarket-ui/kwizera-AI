import fs from "node:fs";
import path from "node:path";
import { ProductionVideoPlanningRecord } from "./types.js";

export class ProductionVideoPlanningRecordStore {
  private storePath = "";
  private records = new Map<string, ProductionVideoPlanningRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "production-video-plans.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ProductionVideoPlanningRecord[];
      for (const record of list) this.records.set(record.videoId, record);
    }
  }

  upsert(record: ProductionVideoPlanningRecord): void {
    this.records.set(record.videoId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(videoId: string): ProductionVideoPlanningRecord | undefined {
    return this.records.get(videoId);
  }

  getAll(): ProductionVideoPlanningRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

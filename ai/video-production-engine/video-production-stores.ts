import fs from "node:fs";
import path from "node:path";
import { VideoProductionRecord } from "./types.js";

export class VideoProductionRecordStore {
  private storePath = "";
  private records = new Map<string, VideoProductionRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "video-production-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as VideoProductionRecord[];
      for (const record of list) {
        this.records.set(record.productionId, record);
      }
    }
  }

  upsert(record: VideoProductionRecord): void {
    this.records.set(record.productionId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(productionId: string): VideoProductionRecord | undefined {
    return this.records.get(productionId);
  }

  getByStoryboard(storyboardId: string): VideoProductionRecord[] {
    return this.getAll().filter((r) => r.profile.storyboardId === storyboardId);
  }

  getAll(): VideoProductionRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

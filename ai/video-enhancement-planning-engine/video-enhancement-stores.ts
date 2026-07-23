import fs from "node:fs";
import path from "node:path";
import { VideoEnhancementPlanRecord } from "./types.js";

export class VideoEnhancementRecordStore {
  private storePath = "";
  private records = new Map<string, VideoEnhancementPlanRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "video-enhancement-plans.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as VideoEnhancementPlanRecord[];
      for (const record of list) this.records.set(record.videoId, record);
    }
  }

  upsert(record: VideoEnhancementPlanRecord): void {
    this.records.set(record.videoId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(videoId: string): VideoEnhancementPlanRecord | undefined {
    return this.records.get(videoId);
  }

  getAll(): VideoEnhancementPlanRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

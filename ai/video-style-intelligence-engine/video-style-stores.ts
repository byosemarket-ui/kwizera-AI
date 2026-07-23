import fs from "node:fs";
import path from "node:path";
import { VideoStyleIntelligenceRecord } from "./types.js";

export class VideoStyleRecordStore {
  private storePath = "";
  private records = new Map<string, VideoStyleIntelligenceRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "video-style-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as VideoStyleIntelligenceRecord[];
      for (const record of list) this.records.set(record.videoId, record);
    }
  }

  upsert(record: VideoStyleIntelligenceRecord): void {
    this.records.set(record.videoId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(videoId: string): VideoStyleIntelligenceRecord | undefined {
    return this.records.get(videoId);
  }

  getAll(): VideoStyleIntelligenceRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

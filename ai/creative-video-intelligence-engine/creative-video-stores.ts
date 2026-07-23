import fs from "node:fs";
import path from "node:path";
import { CreativeVideoIntelligenceRecord } from "./types.js";

export class CreativeVideoRecordStore {
  private storePath = "";
  private records = new Map<string, CreativeVideoIntelligenceRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "creative-video-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as CreativeVideoIntelligenceRecord[];
      for (const record of list) this.records.set(record.videoId, record);
    }
  }

  upsert(record: CreativeVideoIntelligenceRecord): void {
    this.records.set(record.videoId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(videoId: string): CreativeVideoIntelligenceRecord | undefined {
    return this.records.get(videoId);
  }

  getAll(): CreativeVideoIntelligenceRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

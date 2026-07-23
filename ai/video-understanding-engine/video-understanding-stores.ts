import fs from "node:fs";
import path from "node:path";
import { VideoUnderstandingRecord } from "./types.js";

export class VideoUnderstandingRecordStore {
  private storePath = "";
  private records = new Map<string, VideoUnderstandingRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "video-understanding-records.json");
    if (fs.existsSync(this.storePath)) {
      const raw = fs.readFileSync(this.storePath, "utf8");
      const list = JSON.parse(raw) as VideoUnderstandingRecord[];
      for (const record of list) {
        this.records.set(record.videoId, record);
      }
    }
  }

  upsert(record: VideoUnderstandingRecord): void {
    this.records.set(record.videoId, record);
    this.persist();
  }

  get(videoId: string): VideoUnderstandingRecord | undefined {
    return this.records.get(videoId);
  }

  getAll(): VideoUnderstandingRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }
}

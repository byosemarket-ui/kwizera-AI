import fs from "node:fs";
import path from "node:path";
import { TimelineIntelligenceRecord } from "./types.js";

export class TimelineIntelligenceRecordStore {
  private storePath = "";
  private records = new Map<string, TimelineIntelligenceRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "timeline-intelligence-records.json");
    if (fs.existsSync(this.storePath)) {
      const raw = fs.readFileSync(this.storePath, "utf8");
      const list = JSON.parse(raw) as TimelineIntelligenceRecord[];
      for (const record of list) {
        this.records.set(record.videoId, record);
      }
    }
  }

  upsert(record: TimelineIntelligenceRecord): void {
    this.records.set(record.videoId, record);
    this.persist();
  }

  get(videoId: string): TimelineIntelligenceRecord | undefined {
    return this.records.get(videoId);
  }

  getAll(): TimelineIntelligenceRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }
}

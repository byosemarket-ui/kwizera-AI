import fs from "node:fs";
import path from "node:path";
import { MotionIntelligenceRecord } from "./types.js";

export class MotionIntelligenceRecordStore {
  private storePath = "";
  private records = new Map<string, MotionIntelligenceRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "motion-intelligence-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as MotionIntelligenceRecord[];
      for (const record of list) this.records.set(record.videoId, record);
    }
  }

  upsert(record: MotionIntelligenceRecord): void {
    this.records.set(record.videoId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(videoId: string): MotionIntelligenceRecord | undefined {
    return this.records.get(videoId);
  }

  getAll(): MotionIntelligenceRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

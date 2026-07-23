import fs from "node:fs";
import path from "node:path";
import { StoryboardIntelligenceRecord } from "./types.js";

export class StoryboardRecordStore {
  private storePath = "";
  private records = new Map<string, StoryboardIntelligenceRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "storyboard-intelligence-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as StoryboardIntelligenceRecord[];
      for (const record of list) {
        this.records.set(record.storyboardId, record);
      }
    }
  }

  upsert(record: StoryboardIntelligenceRecord): void {
    this.records.set(record.storyboardId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(storyboardId: string): StoryboardIntelligenceRecord | undefined {
    return this.records.get(storyboardId);
  }

  getByProduct(productId: string): StoryboardIntelligenceRecord[] {
    return this.getAll().filter((r) => r.productId === productId);
  }

  getAll(): StoryboardIntelligenceRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

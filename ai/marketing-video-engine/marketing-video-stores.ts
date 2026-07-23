import fs from "node:fs";
import path from "node:path";
import { MarketingVideoRecord } from "./types.js";

export class MarketingVideoRecordStore {
  private storePath = "";
  private records = new Map<string, MarketingVideoRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "marketing-video-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as MarketingVideoRecord[];
      for (const record of list) {
        this.records.set(record.marketingVideoId, record);
      }
    }
  }

  upsert(record: MarketingVideoRecord): void {
    this.records.set(record.marketingVideoId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(marketingVideoId: string): MarketingVideoRecord | undefined {
    return this.records.get(marketingVideoId);
  }

  getByStoryboard(storyboardId: string): MarketingVideoRecord[] {
    return this.getAll().filter((r) => r.profile.storyboardId === storyboardId);
  }

  getAll(): MarketingVideoRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

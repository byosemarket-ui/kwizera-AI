import fs from "node:fs";
import path from "node:path";
import { StoryboardGenerationRecord } from "./types.js";

export class StoryGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, StoryboardGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "story-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as StoryboardGenerationRecord[];
      for (const record of list) {
        this.records.set(record.storyboardId, record);
      }
    }
  }

  upsert(record: StoryboardGenerationRecord): void {
    this.records.set(record.storyboardId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(storyboardId: string): StoryboardGenerationRecord | undefined {
    return this.records.get(storyboardId);
  }

  getByProduct(productId: string): StoryboardGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getByProject(projectId: string): StoryboardGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.projectId === projectId);
  }

  getByCampaign(campaignId: string): StoryboardGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.campaignId === campaignId);
  }

  getAll(): StoryboardGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

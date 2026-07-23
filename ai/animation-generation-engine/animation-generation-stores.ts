import fs from "node:fs";
import path from "node:path";
import { AnimationGenerationRecord } from "./types.js";

export class AnimationGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, AnimationGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "animation-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as AnimationGenerationRecord[];
      for (const record of list) {
        this.records.set(record.animationPlanId, record);
      }
    }
  }

  upsert(record: AnimationGenerationRecord): void {
    this.records.set(record.animationPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(animationPlanId: string): AnimationGenerationRecord | undefined {
    return this.records.get(animationPlanId);
  }

  getByScene(sceneId: string): AnimationGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.sceneId === sceneId);
  }

  getByStoryboard(storyboardId: string): AnimationGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.storyboardId === storyboardId);
  }

  getAll(): AnimationGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

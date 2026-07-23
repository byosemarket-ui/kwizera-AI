import fs from "node:fs";
import path from "node:path";
import { VisualEffectsGenerationRecord } from "./types.js";

export class VisualEffectsGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, VisualEffectsGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "visual-effects-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as VisualEffectsGenerationRecord[];
      for (const record of list) {
        this.records.set(record.visualEffectPlanId, record);
      }
    }
  }

  upsert(record: VisualEffectsGenerationRecord): void {
    this.records.set(record.visualEffectPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(visualEffectPlanId: string): VisualEffectsGenerationRecord | undefined {
    return this.records.get(visualEffectPlanId);
  }

  getByScene(sceneId: string): VisualEffectsGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.sceneId === sceneId);
  }

  getByStoryboard(storyboardId: string): VisualEffectsGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.storyboardId === storyboardId);
  }

  getAll(): VisualEffectsGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

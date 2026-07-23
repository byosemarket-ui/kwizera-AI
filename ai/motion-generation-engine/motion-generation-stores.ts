import fs from "node:fs";
import path from "node:path";
import { MotionGenerationRecord } from "./types.js";

export class MotionGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, MotionGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "motion-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as MotionGenerationRecord[];
      for (const record of list) {
        this.records.set(record.motionPlanId, record);
      }
    }
  }

  upsert(record: MotionGenerationRecord): void {
    this.records.set(record.motionPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(motionPlanId: string): MotionGenerationRecord | undefined {
    return this.records.get(motionPlanId);
  }

  getByScene(sceneId: string): MotionGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.sceneId === sceneId);
  }

  getByStoryboard(storyboardId: string): MotionGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.storyboardId === storyboardId);
  }

  getAll(): MotionGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

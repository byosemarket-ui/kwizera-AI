import fs from "node:fs";
import path from "node:path";
import { SceneGenerationRecord } from "./types.js";

export class SceneGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, SceneGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "scene-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as SceneGenerationRecord[];
      for (const record of list) {
        this.records.set(record.sceneId, record);
      }
    }
  }

  upsert(record: SceneGenerationRecord): void {
    this.records.set(record.sceneId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(sceneId: string): SceneGenerationRecord | undefined {
    return this.records.get(sceneId);
  }

  getByStoryboard(storyboardId: string): SceneGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.storyboardId === storyboardId);
  }

  getByProduct(productId: string): SceneGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getAll(): SceneGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

import fs from "node:fs";
import path from "node:path";
import { SceneDetectionRecord } from "./types.js";

export class SceneDetectionRecordStore {
  private storePath = "";
  private records = new Map<string, SceneDetectionRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "scene-detection-records.json");
    if (fs.existsSync(this.storePath)) {
      const raw = fs.readFileSync(this.storePath, "utf8");
      const list = JSON.parse(raw) as SceneDetectionRecord[];
      for (const record of list) {
        this.records.set(record.videoId, record);
      }
    }
  }

  upsert(record: SceneDetectionRecord): void {
    this.records.set(record.videoId, record);
    this.persist();
  }

  get(videoId: string): SceneDetectionRecord | undefined {
    return this.records.get(videoId);
  }

  getAll(): SceneDetectionRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }
}

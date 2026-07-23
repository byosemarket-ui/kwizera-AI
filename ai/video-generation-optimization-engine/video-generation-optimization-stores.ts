import fs from "node:fs";
import path from "node:path";
import { VideoGenerationOptimizationRecord } from "./types.js";

export class OptimizationRecordStore {
  private storePath = "";
  private records = new Map<string, VideoGenerationOptimizationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "optimization-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as VideoGenerationOptimizationRecord[];
      for (const record of list) {
        this.records.set(record.optimizationId, record);
      }
    }
  }

  upsert(record: VideoGenerationOptimizationRecord): void {
    this.records.set(record.optimizationId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(optimizationId: string): VideoGenerationOptimizationRecord | undefined {
    return this.records.get(optimizationId);
  }

  getByStoryboard(storyboardId: string): VideoGenerationOptimizationRecord[] {
    return this.getAll().filter((r) => r.relationships.storyboards.includes(storyboardId));
  }

  getAll(): VideoGenerationOptimizationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

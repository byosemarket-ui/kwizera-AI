import fs from "node:fs";
import path from "node:path";
import { RenderingPreparationRecord } from "./types.js";

export class RenderingPreparationRecordStore {
  private storePath = "";
  private records = new Map<string, RenderingPreparationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "rendering-preparation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as RenderingPreparationRecord[];
      for (const record of list) {
        this.records.set(record.renderPlanId, record);
      }
    }
  }

  upsert(record: RenderingPreparationRecord): void {
    this.records.set(record.renderPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(renderPlanId: string): RenderingPreparationRecord | undefined {
    return this.records.get(renderPlanId);
  }

  getByStoryboard(storyboardId: string): RenderingPreparationRecord[] {
    return this.getAll().filter((r) => r.relationships.storyboards.includes(storyboardId));
  }

  getAll(): RenderingPreparationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

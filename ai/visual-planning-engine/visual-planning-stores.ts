import fs from "node:fs";
import path from "node:path";
import { VisualPlanningRecord } from "./types.js";

export class VisualPlanningRecordStore {
  private storePath = "";
  private records = new Map<string, VisualPlanningRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "visual-planning-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as VisualPlanningRecord[];
      for (const record of list) {
        this.records.set(record.visualPlanId, record);
      }
    }
  }

  upsert(record: VisualPlanningRecord): void {
    this.records.set(record.visualPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(visualPlanId: string): VisualPlanningRecord | undefined {
    return this.records.get(visualPlanId);
  }

  getByProduct(productId: string): VisualPlanningRecord[] {
    return this.getAll().filter((r) => r.productId === productId);
  }

  getAll(): VisualPlanningRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

import fs from "node:fs";
import path from "node:path";
import { ScriptPlanningRecord } from "./types.js";

export class ScriptPlanningRecordStore {
  private storePath = "";
  private records = new Map<string, ScriptPlanningRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "script-planning-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ScriptPlanningRecord[];
      for (const record of list) {
        this.records.set(record.scriptPlanId, record);
      }
    }
  }

  upsert(record: ScriptPlanningRecord): void {
    this.records.set(record.scriptPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(scriptPlanId: string): ScriptPlanningRecord | undefined {
    return this.records.get(scriptPlanId);
  }

  getByProduct(productId: string): ScriptPlanningRecord[] {
    return this.getAll().filter((r) => r.productId === productId);
  }

  getAll(): ScriptPlanningRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

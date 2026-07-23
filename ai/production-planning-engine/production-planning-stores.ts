import fs from "node:fs";
import path from "node:path";
import { ProductionPlanningRecord } from "./types.js";

export class ProductionPlanningRecordStore {
  private storePath = "";
  private records = new Map<string, ProductionPlanningRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "production-planning-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ProductionPlanningRecord[];
      for (const record of list) {
        this.records.set(record.productionPlanId, record);
      }
    }
  }

  upsert(record: ProductionPlanningRecord): void {
    this.records.set(record.productionPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(productionPlanId: string): ProductionPlanningRecord | undefined {
    return this.records.get(productionPlanId);
  }

  getByProduct(productId: string): ProductionPlanningRecord[] {
    return this.getAll().filter((r) => r.productId === productId);
  }

  getAll(): ProductionPlanningRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

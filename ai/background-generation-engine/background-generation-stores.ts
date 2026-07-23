import fs from "node:fs";
import path from "node:path";
import { BackgroundGenerationRecord } from "./types.js";

export class BackgroundGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, BackgroundGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "background-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as BackgroundGenerationRecord[];
      for (const record of list) {
        this.records.set(record.backgroundPlanId, record);
      }
    }
  }

  upsert(record: BackgroundGenerationRecord): void {
    this.records.set(record.backgroundPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(backgroundPlanId: string): BackgroundGenerationRecord | undefined {
    return this.records.get(backgroundPlanId);
  }

  getBySourceImage(sourceImageId: string): BackgroundGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.sourceImageId === sourceImageId);
  }

  getByProduct(productId: string): BackgroundGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getAll(): BackgroundGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

import fs from "node:fs";
import path from "node:path";
import { MultiStyleImageRecord } from "./types.js";

export class MultiStyleImageRecordStore {
  private storePath = "";
  private records = new Map<string, MultiStyleImageRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "multi-style-image-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as MultiStyleImageRecord[];
      for (const record of list) {
        this.records.set(record.stylePlanId, record);
      }
    }
  }

  upsert(record: MultiStyleImageRecord): void {
    this.records.set(record.stylePlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(stylePlanId: string): MultiStyleImageRecord | undefined {
    return this.records.get(stylePlanId);
  }

  getByProduct(productId: string): MultiStyleImageRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getBySourceImage(sourceImageId: string): MultiStyleImageRecord[] {
    return this.getAll().filter((r) => r.profile.sourceImageId === sourceImageId);
  }

  getAll(): MultiStyleImageRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

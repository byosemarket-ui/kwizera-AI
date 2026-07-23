import fs from "node:fs";
import path from "node:path";
import { CreativeDirectionRecord } from "./types.js";

export class CreativeDirectionRecordStore {
  private storePath = "";
  private records = new Map<string, CreativeDirectionRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "creative-direction-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as CreativeDirectionRecord[];
      for (const record of list) {
        this.records.set(record.creativeId, record);
      }
    }
  }

  upsert(record: CreativeDirectionRecord): void {
    this.records.set(record.creativeId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(creativeId: string): CreativeDirectionRecord | undefined {
    return this.records.get(creativeId);
  }

  getByProduct(productId: string): CreativeDirectionRecord[] {
    return this.getAll().filter((r) => r.productId === productId);
  }

  getAll(): CreativeDirectionRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

import fs from "node:fs";
import path from "node:path";
import { LightingColorIntelligenceRecord } from "./types.js";

export class LightingColorIntelligenceRecordStore {
  private storePath = "";
  private records = new Map<string, LightingColorIntelligenceRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "lighting-color-intelligence-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as LightingColorIntelligenceRecord[];
      for (const record of list) {
        this.records.set(record.imageId, record);
      }
    }
  }

  upsert(record: LightingColorIntelligenceRecord): void {
    this.records.set(record.imageId, record);
    this.persist();
  }

  get(imageId: string): LightingColorIntelligenceRecord | undefined {
    return this.records.get(imageId);
  }

  getAll(): LightingColorIntelligenceRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }
}

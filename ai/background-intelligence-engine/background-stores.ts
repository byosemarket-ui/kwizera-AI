import fs from "node:fs";
import path from "node:path";
import { BackgroundIntelligenceRecord } from "./types.js";

export class BackgroundIntelligenceRecordStore {
  private storePath = "";
  private records = new Map<string, BackgroundIntelligenceRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "background-intelligence-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as BackgroundIntelligenceRecord[];
      for (const record of list) {
        this.records.set(record.imageId, record);
      }
    }
  }

  upsert(record: BackgroundIntelligenceRecord): void {
    this.records.set(record.imageId, record);
    this.persist();
  }

  get(imageId: string): BackgroundIntelligenceRecord | undefined {
    return this.records.get(imageId);
  }

  getAll(): BackgroundIntelligenceRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }
}

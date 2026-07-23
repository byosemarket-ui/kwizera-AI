import fs from "node:fs";
import path from "node:path";
import { AudienceIntelligenceRecord } from "./types.js";

export class AudienceRecordStore {
  private storePath = "";
  private records = new Map<string, AudienceIntelligenceRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "audience-intelligence-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as AudienceIntelligenceRecord[];
      for (const record of list) {
        this.records.set(record.audienceId, record);
      }
    }
  }

  upsert(record: AudienceIntelligenceRecord): void {
    this.records.set(record.audienceId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(audienceId: string): AudienceIntelligenceRecord | undefined {
    return this.records.get(audienceId);
  }

  getByProduct(productId: string): AudienceIntelligenceRecord[] {
    return this.getAll().filter((r) => r.productId === productId);
  }

  getAll(): AudienceIntelligenceRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

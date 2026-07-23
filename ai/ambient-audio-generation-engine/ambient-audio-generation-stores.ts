import fs from "node:fs";
import path from "node:path";
import { AmbientAudioGenerationRecord } from "./types.js";

export class AmbientAudioGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, AmbientAudioGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "ambient-audio-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as AmbientAudioGenerationRecord[];
      for (const record of list) {
        this.records.set(record.ambientPlanId, record);
      }
    }
  }

  upsert(record: AmbientAudioGenerationRecord): void {
    this.records.set(record.ambientPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(ambientPlanId: string): AmbientAudioGenerationRecord | undefined {
    return this.records.get(ambientPlanId);
  }

  getByProduct(productId: string): AmbientAudioGenerationRecord[] {
    return this.getAll().filter((r) => r.relationships.products.includes(productId));
  }

  getByCategory(category: string): AmbientAudioGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.environmentCategory === category);
  }

  getAll(): AmbientAudioGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

import fs from "node:fs";
import path from "node:path";
import { AudioEnhancementGenerationRecord } from "./types.js";

export class AudioEnhancementRestorationRecordStore {
  private storePath = "";
  private records = new Map<string, AudioEnhancementGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "audio-enhancement-restoration-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as AudioEnhancementGenerationRecord[];
      for (const record of list) {
        this.records.set(record.enhancementPlanId, record);
      }
    }
  }

  upsert(record: AudioEnhancementGenerationRecord): void {
    this.records.set(record.enhancementPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(enhancementPlanId: string): AudioEnhancementGenerationRecord | undefined {
    return this.records.get(enhancementPlanId);
  }

  getByProduct(productId: string): AudioEnhancementGenerationRecord[] {
    return this.getAll().filter((r) => r.relationships.products.includes(productId));
  }

  getByType(enhancementType: string): AudioEnhancementGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.enhancementType === enhancementType);
  }

  getAll(): AudioEnhancementGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

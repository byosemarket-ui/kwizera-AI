import fs from "node:fs";
import path from "node:path";
import { SoundEffectsGenerationRecord } from "./types.js";

export class SoundEffectsGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, SoundEffectsGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "sound-effects-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as SoundEffectsGenerationRecord[];
      for (const record of list) {
        this.records.set(record.soundPlanId, record);
      }
    }
  }

  upsert(record: SoundEffectsGenerationRecord): void {
    this.records.set(record.soundPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(soundPlanId: string): SoundEffectsGenerationRecord | undefined {
    return this.records.get(soundPlanId);
  }

  getByProduct(productId: string): SoundEffectsGenerationRecord[] {
    return this.getAll().filter((r) => r.relationships.products.includes(productId));
  }

  getByCategory(category: string): SoundEffectsGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.soundCategory === category);
  }

  getByProject(projectId: string): SoundEffectsGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.projectId === projectId);
  }

  getAll(): SoundEffectsGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

import fs from "node:fs";
import path from "node:path";
import { AudioMixMasterGenerationRecord } from "./types.js";

export class AudioMixingMasteringRecordStore {
  private storePath = "";
  private records = new Map<string, AudioMixMasterGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "audio-mixing-mastering-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as AudioMixMasterGenerationRecord[];
      for (const record of list) {
        this.records.set(record.mixingPlanId, record);
      }
    }
  }

  upsert(record: AudioMixMasterGenerationRecord): void {
    this.records.set(record.mixingPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(mixingPlanId: string): AudioMixMasterGenerationRecord | undefined {
    return this.records.get(mixingPlanId);
  }

  getByProduct(productId: string): AudioMixMasterGenerationRecord[] {
    return this.getAll().filter((r) => r.relationships.products.includes(productId));
  }

  getBySession(sessionId: string): AudioMixMasterGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.sessionId === sessionId);
  }

  getAll(): AudioMixMasterGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

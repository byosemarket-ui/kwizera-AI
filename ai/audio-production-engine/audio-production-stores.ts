import fs from "node:fs";
import path from "node:path";
import { AudioProductionRecord } from "./types.js";

export class AudioProductionRecordStore {
  private storePath = "";
  private records = new Map<string, AudioProductionRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "audio-production-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as AudioProductionRecord[];
      for (const record of list) {
        this.records.set(record.audioProductionId, record);
      }
    }
  }

  upsert(record: AudioProductionRecord): void {
    this.records.set(record.audioProductionId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(audioProductionId: string): AudioProductionRecord | undefined {
    return this.records.get(audioProductionId);
  }

  getByAudioPlan(audioPlanId: string): AudioProductionRecord[] {
    return this.getAll().filter((r) => r.profile.audioPlanId === audioPlanId);
  }

  getByProduct(productId: string): AudioProductionRecord[] {
    return this.getAll().filter((r) => r.relationships.products.includes(productId));
  }

  getAll(): AudioProductionRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

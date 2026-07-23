import fs from "node:fs";
import path from "node:path";
import { AudioPlanningRecord } from "./types.js";

export class AudioPlanningRecordStore {
  private storePath = "";
  private records = new Map<string, AudioPlanningRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "audio-planning-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as AudioPlanningRecord[];
      for (const record of list) {
        this.records.set(record.audioPlanId, record);
      }
    }
  }

  upsert(record: AudioPlanningRecord): void {
    this.records.set(record.audioPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(audioPlanId: string): AudioPlanningRecord | undefined {
    return this.records.get(audioPlanId);
  }

  getByProduct(productId: string): AudioPlanningRecord[] {
    return this.getAll().filter((r) => r.productId === productId);
  }

  getAll(): AudioPlanningRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

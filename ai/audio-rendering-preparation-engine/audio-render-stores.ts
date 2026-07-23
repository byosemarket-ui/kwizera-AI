import fs from "node:fs";
import path from "node:path";
import { AudioRenderRecord } from "./types.js";

export class AudioRenderRecordStore {
  private storePath = "";
  private records = new Map<string, AudioRenderRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "audio-render-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as AudioRenderRecord[];
      for (const record of list) {
        this.records.set(record.audioRenderPlanId, record);
      }
    }
  }

  upsert(record: AudioRenderRecord): void {
    this.records.set(record.audioRenderPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(audioRenderPlanId: string): AudioRenderRecord | undefined {
    return this.records.get(audioRenderPlanId);
  }

  getByProduction(productionId: string): AudioRenderRecord[] {
    return this.getAll().filter((r) => r.profile.productionId === productionId);
  }

  getByProduct(productId: string): AudioRenderRecord[] {
    return this.getAll().filter((r) => r.relationships.products.includes(productId));
  }

  getAll(): AudioRenderRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

import fs from "node:fs";
import path from "node:path";
import { AudioQualityValidationRecord } from "./types.js";

export class AudioQualityValidationRecordStore {
  private storePath = "";
  private records = new Map<string, AudioQualityValidationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "audio-quality-validation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as AudioQualityValidationRecord[];
      for (const record of list) {
        this.records.set(record.audioQualityValidationId, record);
      }
    }
  }

  upsert(record: AudioQualityValidationRecord): void {
    this.records.set(record.audioQualityValidationId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(audioQualityValidationId: string): AudioQualityValidationRecord | undefined {
    return this.records.get(audioQualityValidationId);
  }

  getByProduct(productId: string): AudioQualityValidationRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getByRenderPlan(renderPlanId: string): AudioQualityValidationRecord[] {
    return this.getAll().filter((r) => r.profile.renderPlanId === renderPlanId);
  }

  getAll(): AudioQualityValidationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

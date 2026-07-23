import fs from "node:fs";
import path from "node:path";
import { QualityValidationRecord } from "./types.js";

export class QualityValidationRecordStore {
  private storePath = "";
  private records = new Map<string, QualityValidationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "quality-validation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as QualityValidationRecord[];
      for (const record of list) {
        this.records.set(record.validationId, record);
      }
    }
  }

  upsert(record: QualityValidationRecord): void {
    this.records.set(record.validationId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(validationId: string): QualityValidationRecord | undefined {
    return this.records.get(validationId);
  }

  getByStoryboard(storyboardId: string): QualityValidationRecord[] {
    return this.getAll().filter((r) => r.relationships.storyboards.includes(storyboardId));
  }

  getAll(): QualityValidationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

import fs from "node:fs";
import path from "node:path";
import { ImageQualityPredictionRecord } from "./types.js";

export class ImageQualityPredictionRecordStore {
  private storePath = "";
  private records = new Map<string, ImageQualityPredictionRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "image-quality-prediction-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ImageQualityPredictionRecord[];
      for (const record of list) {
        this.records.set(record.imageId, record);
      }
    }
  }

  upsert(record: ImageQualityPredictionRecord): void {
    this.records.set(record.imageId, record);
    this.persist();
  }

  get(imageId: string): ImageQualityPredictionRecord | undefined {
    return this.records.get(imageId);
  }

  getAll(): ImageQualityPredictionRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }
}

import fs from "node:fs";
import path from "node:path";
import { QualityPredictionRecord } from "./types.js";

export class QualityPredictionRecordStore {
  private storePath = "";
  private records = new Map<string, QualityPredictionRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "quality-prediction-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as QualityPredictionRecord[];
      for (const record of list) {
        this.records.set(record.predictionId, record);
      }
    }
  }

  upsert(record: QualityPredictionRecord): void {
    this.records.set(record.predictionId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(predictionId: string): QualityPredictionRecord | undefined {
    return this.records.get(predictionId);
  }

  getByProduct(productId: string): QualityPredictionRecord[] {
    return this.getAll().filter((r) => r.productId === productId);
  }

  getAll(): QualityPredictionRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

import fs from "node:fs";
import path from "node:path";
import { ImageAnalysisIntelligenceRecord } from "./types.js";

export class ImageAnalysisRecordStore {
  private storePath = "";
  private records = new Map<string, ImageAnalysisIntelligenceRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "image-analysis-records.json");
    if (fs.existsSync(this.storePath)) {
      const raw = fs.readFileSync(this.storePath, "utf8");
      const list = JSON.parse(raw) as ImageAnalysisIntelligenceRecord[];
      for (const record of list) {
        this.records.set(record.imageId, record);
      }
    }
  }

  upsert(record: ImageAnalysisIntelligenceRecord): void {
    this.records.set(record.imageId, record);
    this.persist();
  }

  get(imageId: string): ImageAnalysisIntelligenceRecord | undefined {
    return this.records.get(imageId);
  }

  getAll(): ImageAnalysisIntelligenceRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }
}

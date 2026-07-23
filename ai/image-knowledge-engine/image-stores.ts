import fs from "node:fs";
import path from "node:path";
import { ImageAnalysisRecord, ImageLearningPattern } from "./types.js";

export class ImagePatternStore {
  private storePath = "";
  private patterns: ImageLearningPattern[] = [];

  initialize(imageDir: string): void {
    fs.mkdirSync(imageDir, { recursive: true });
    this.storePath = path.join(imageDir, "learned-patterns.json");
    if (fs.existsSync(this.storePath)) {
      this.patterns = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ImageLearningPattern[];
    }
  }

  add(pattern: ImageLearningPattern): void {
    if (this.patterns.some((p) => p.patternId === pattern.patternId)) return;
    this.patterns.push(pattern);
    this.persist();
  }

  getAll(): ImageLearningPattern[] {
    return [...this.patterns];
  }

  getCount(): number {
    return this.patterns.length;
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.patterns, null, 2), "utf8");
  }
}

export class ImageRecordStore {
  private storePath = "";
  private records = new Map<string, ImageAnalysisRecord>();

  initialize(imageDir: string): void {
    fs.mkdirSync(imageDir, { recursive: true });
    this.storePath = path.join(imageDir, "image-analysis-records.json");
    if (fs.existsSync(this.storePath)) {
      const data = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ImageAnalysisRecord[];
      for (const record of data) {
        this.records.set(record.imageId, record);
      }
    }
  }

  upsert(record: ImageAnalysisRecord): void {
    this.records.set(record.imageId, record);
    this.persist();
  }

  get(imageId: string): ImageAnalysisRecord | undefined {
    return this.records.get(imageId);
  }

  getAll(): ImageAnalysisRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
  }
}

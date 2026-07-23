import fs from "node:fs";
import path from "node:path";
import { BrandAnalysisRecord, BrandKnowledgeLearningPattern } from "./types.js";

export class BrandPatternStore {
  private storePath = "";
  private patterns: BrandKnowledgeLearningPattern[] = [];

  initialize(brandDir: string): void {
    fs.mkdirSync(brandDir, { recursive: true });
    this.storePath = path.join(brandDir, "learned-patterns.json");
    if (fs.existsSync(this.storePath)) {
      this.patterns = JSON.parse(
        fs.readFileSync(this.storePath, "utf8")
      ) as BrandKnowledgeLearningPattern[];
    }
  }

  add(pattern: BrandKnowledgeLearningPattern): void {
    if (this.patterns.some((p) => p.patternId === pattern.patternId)) return;
    this.patterns.push(pattern);
    fs.writeFileSync(this.storePath, JSON.stringify(this.patterns, null, 2), "utf8");
  }

  getAll(): BrandKnowledgeLearningPattern[] {
    return [...this.patterns];
  }

  getCount(): number {
    return this.patterns.length;
  }
}

export class BrandRecordStore {
  private storePath = "";
  private records = new Map<string, BrandAnalysisRecord>();

  initialize(brandDir: string): void {
    fs.mkdirSync(brandDir, { recursive: true });
    this.storePath = path.join(brandDir, "brand-analysis-records.json");
    if (fs.existsSync(this.storePath)) {
      const data = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as BrandAnalysisRecord[];
      for (const record of data) {
        this.records.set(record.brandId, record);
      }
    }
  }

  upsert(record: BrandAnalysisRecord): void {
    this.records.set(record.brandId, record);
    fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
  }

  get(brandId: string): BrandAnalysisRecord | undefined {
    return this.records.get(brandId);
  }

  getAll(): BrandAnalysisRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

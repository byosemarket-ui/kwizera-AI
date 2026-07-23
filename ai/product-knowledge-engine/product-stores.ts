import fs from "node:fs";
import path from "node:path";
import { ProductAnalysisRecord, ProductKnowledgeLearningPattern } from "./types.js";

export class ProductPatternStore {
  private storePath = "";
  private patterns: ProductKnowledgeLearningPattern[] = [];

  initialize(productDir: string): void {
    fs.mkdirSync(productDir, { recursive: true });
    this.storePath = path.join(productDir, "learned-patterns.json");
    if (fs.existsSync(this.storePath)) {
      this.patterns = JSON.parse(
        fs.readFileSync(this.storePath, "utf8")
      ) as ProductKnowledgeLearningPattern[];
    }
  }

  add(pattern: ProductKnowledgeLearningPattern): void {
    if (this.patterns.some((p) => p.patternId === pattern.patternId)) return;
    this.patterns.push(pattern);
    fs.writeFileSync(this.storePath, JSON.stringify(this.patterns, null, 2), "utf8");
  }

  getAll(): ProductKnowledgeLearningPattern[] {
    return [...this.patterns];
  }

  getCount(): number {
    return this.patterns.length;
  }
}

export class ProductRecordStore {
  private storePath = "";
  private records = new Map<string, ProductAnalysisRecord>();

  initialize(productDir: string): void {
    fs.mkdirSync(productDir, { recursive: true });
    this.storePath = path.join(productDir, "product-analysis-records.json");
    if (fs.existsSync(this.storePath)) {
      const data = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ProductAnalysisRecord[];
      for (const record of data) {
        this.records.set(record.productId, record);
      }
    }
  }

  upsert(record: ProductAnalysisRecord): void {
    this.records.set(record.productId, record);
    fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
  }

  get(productId: string): ProductAnalysisRecord | undefined {
    return this.records.get(productId);
  }

  getAll(): ProductAnalysisRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

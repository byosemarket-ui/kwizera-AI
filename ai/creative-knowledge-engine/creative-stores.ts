import fs from "node:fs";
import path from "node:path";
import { CreativeAnalysisRecord, CreativeKnowledgeLearningPattern } from "./types.js";

export class CreativePatternStore {
  private storePath = "";
  private patterns: CreativeKnowledgeLearningPattern[] = [];

  initialize(creativeDir: string): void {
    fs.mkdirSync(creativeDir, { recursive: true });
    this.storePath = path.join(creativeDir, "learned-patterns.json");
    if (fs.existsSync(this.storePath)) {
      this.patterns = JSON.parse(
        fs.readFileSync(this.storePath, "utf8")
      ) as CreativeKnowledgeLearningPattern[];
    }
  }

  add(pattern: CreativeKnowledgeLearningPattern): void {
    if (this.patterns.some((p) => p.patternId === pattern.patternId)) return;
    this.patterns.push(pattern);
    fs.writeFileSync(this.storePath, JSON.stringify(this.patterns, null, 2), "utf8");
  }

  getAll(): CreativeKnowledgeLearningPattern[] {
    return [...this.patterns];
  }

  getCount(): number {
    return this.patterns.length;
  }
}

export class CreativeRecordStore {
  private storePath = "";
  private records = new Map<string, CreativeAnalysisRecord>();

  initialize(creativeDir: string): void {
    fs.mkdirSync(creativeDir, { recursive: true });
    this.storePath = path.join(creativeDir, "creative-analysis-records.json");
    if (fs.existsSync(this.storePath)) {
      const data = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as CreativeAnalysisRecord[];
      for (const record of data) {
        this.records.set(record.creativeId, record);
      }
    }
  }

  upsert(record: CreativeAnalysisRecord): void {
    this.records.set(record.creativeId, record);
    fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
  }

  get(creativeId: string): CreativeAnalysisRecord | undefined {
    return this.records.get(creativeId);
  }

  getAll(): CreativeAnalysisRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

import fs from "node:fs";
import path from "node:path";
import { LanguageAnalysisRecord, LanguageKnowledgeLearningPattern } from "./types.js";

export class LanguagePatternStore {
  private storePath = "";
  private patterns: LanguageKnowledgeLearningPattern[] = [];

  initialize(langDir: string): void {
    fs.mkdirSync(langDir, { recursive: true });
    this.storePath = path.join(langDir, "learned-patterns.json");
    if (fs.existsSync(this.storePath)) {
      this.patterns = JSON.parse(
        fs.readFileSync(this.storePath, "utf8")
      ) as LanguageKnowledgeLearningPattern[];
    }
  }

  add(pattern: LanguageKnowledgeLearningPattern): void {
    if (this.patterns.some((p) => p.patternId === pattern.patternId)) return;
    this.patterns.push(pattern);
    fs.writeFileSync(this.storePath, JSON.stringify(this.patterns, null, 2), "utf8");
  }

  getAll(): LanguageKnowledgeLearningPattern[] {
    return [...this.patterns];
  }

  getCount(): number {
    return this.patterns.length;
  }
}

export class LanguageRecordStore {
  private storePath = "";
  private records = new Map<string, LanguageAnalysisRecord>();

  initialize(langDir: string): void {
    fs.mkdirSync(langDir, { recursive: true });
    this.storePath = path.join(langDir, "language-analysis-records.json");
    if (fs.existsSync(this.storePath)) {
      const data = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as LanguageAnalysisRecord[];
      for (const record of data) {
        this.records.set(record.languageId, record);
      }
    }
  }

  upsert(record: LanguageAnalysisRecord): void {
    this.records.set(record.languageId, record);
    fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
  }

  get(languageId: string): LanguageAnalysisRecord | undefined {
    return this.records.get(languageId);
  }

  getAll(): LanguageAnalysisRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

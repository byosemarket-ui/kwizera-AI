import fs from "node:fs";
import path from "node:path";
import { MarketingAnalysisRecord, MarketingLearningPattern } from "./types.js";

export class MarketingPatternStore {
  private storePath = "";
  private patterns: MarketingLearningPattern[] = [];

  initialize(marketingDir: string): void {
    fs.mkdirSync(marketingDir, { recursive: true });
    this.storePath = path.join(marketingDir, "learned-patterns.json");
    if (fs.existsSync(this.storePath)) {
      this.patterns = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as MarketingLearningPattern[];
    }
  }

  add(pattern: MarketingLearningPattern): void {
    if (this.patterns.some((p) => p.patternId === pattern.patternId)) return;
    this.patterns.push(pattern);
    fs.writeFileSync(this.storePath, JSON.stringify(this.patterns, null, 2), "utf8");
  }

  getAll(): MarketingLearningPattern[] {
    return [...this.patterns];
  }

  getCount(): number {
    return this.patterns.length;
  }
}

export class MarketingRecordStore {
  private storePath = "";
  private records = new Map<string, MarketingAnalysisRecord>();

  initialize(marketingDir: string): void {
    fs.mkdirSync(marketingDir, { recursive: true });
    this.storePath = path.join(marketingDir, "marketing-analysis-records.json");
    if (fs.existsSync(this.storePath)) {
      const data = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as MarketingAnalysisRecord[];
      for (const record of data) {
        this.records.set(record.campaignId, record);
      }
    }
  }

  upsert(record: MarketingAnalysisRecord): void {
    this.records.set(record.campaignId, record);
    fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
  }

  get(campaignId: string): MarketingAnalysisRecord | undefined {
    return this.records.get(campaignId);
  }

  getAll(): MarketingAnalysisRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

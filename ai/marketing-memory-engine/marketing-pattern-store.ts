import fs from "node:fs";
import path from "node:path";
import { MarketingPattern } from "./types.js";

export class MarketingPatternStore {
  private patternsPath: string | null = null;
  private readonly patterns: MarketingPattern[] = [];

  initialize(marketingDir: string): void {
    fs.mkdirSync(marketingDir, { recursive: true });
    this.patternsPath = path.join(marketingDir, "marketing-patterns.jsonl");
    if (fs.existsSync(this.patternsPath)) {
      const lines = fs.readFileSync(this.patternsPath, "utf8").trim().split("\n").filter(Boolean);
      for (const line of lines) {
        this.patterns.push(JSON.parse(line) as MarketingPattern);
      }
    }
  }

  store(pattern: MarketingPattern): void {
    this.patterns.push(pattern);
    if (this.patternsPath) {
      fs.appendFileSync(this.patternsPath, `${JSON.stringify(pattern)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<MarketingPattern> {
    return this.patterns;
  }

  getByType(type: MarketingPattern["patternType"]): MarketingPattern[] {
    return this.patterns.filter((p) => p.patternType === type);
  }

  getReusable(): MarketingPattern[] {
    return this.patterns.filter((p) => p.reusable && p.confidence >= 60);
  }

  getCount(): number {
    return this.patterns.length;
  }
}

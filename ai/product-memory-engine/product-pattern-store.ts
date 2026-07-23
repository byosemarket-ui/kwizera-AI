import fs from "node:fs";
import path from "node:path";
import { ProductPattern } from "./types.js";

export class ProductPatternStore {
  private patternsPath: string | null = null;
  private readonly patterns: ProductPattern[] = [];

  initialize(productDir: string): void {
    fs.mkdirSync(productDir, { recursive: true });
    this.patternsPath = path.join(productDir, "product-patterns.jsonl");
    if (fs.existsSync(this.patternsPath)) {
      const lines = fs.readFileSync(this.patternsPath, "utf8").trim().split("\n").filter(Boolean);
      for (const line of lines) {
        this.patterns.push(JSON.parse(line) as ProductPattern);
      }
    }
  }

  store(pattern: ProductPattern): void {
    this.patterns.push(pattern);
    if (this.patternsPath) {
      fs.appendFileSync(this.patternsPath, `${JSON.stringify(pattern)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<ProductPattern> {
    return this.patterns;
  }

  getReusable(): ProductPattern[] {
    return this.patterns.filter((p) => p.reusable && p.confidence >= 60);
  }

  getCount(): number {
    return this.patterns.length;
  }
}

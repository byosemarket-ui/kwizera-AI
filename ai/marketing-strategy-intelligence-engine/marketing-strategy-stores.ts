import fs from "node:fs";
import path from "node:path";
import { MarketingStrategyRecord } from "./types.js";

export class MarketingStrategyRecordStore {
  private storePath = "";
  private records = new Map<string, MarketingStrategyRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "marketing-strategy-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as MarketingStrategyRecord[];
      for (const record of list) {
        this.records.set(record.strategyId, record);
      }
    }
  }

  upsert(record: MarketingStrategyRecord): void {
    this.records.set(record.strategyId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(strategyId: string): MarketingStrategyRecord | undefined {
    return this.records.get(strategyId);
  }

  getByProduct(productId: string): MarketingStrategyRecord[] {
    return this.getAll().filter((r) => r.productId === productId);
  }

  getAll(): MarketingStrategyRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}

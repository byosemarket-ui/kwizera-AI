import fs from "node:fs";
import path from "node:path";

export interface ProductHistoryEvent {
  timestamp: string;
  event: "create" | "update" | "learn" | "pattern" | "preference";
  productId: string;
  detail: string;
  version?: number;
}

export class ProductHistoryStore {
  private historyPath: string | null = null;
  private readonly events: ProductHistoryEvent[] = [];

  initialize(productDir: string): void {
    fs.mkdirSync(productDir, { recursive: true });
    this.historyPath = path.join(productDir, "product-history.jsonl");
    if (fs.existsSync(this.historyPath)) {
      const lines = fs.readFileSync(this.historyPath, "utf8").trim().split("\n").filter(Boolean);
      for (const line of lines) {
        this.events.push(JSON.parse(line) as ProductHistoryEvent);
      }
    }
  }

  append(event: ProductHistoryEvent): void {
    this.events.push(event);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(event)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<ProductHistoryEvent> {
    return this.events;
  }

  getByProduct(productId: string): ProductHistoryEvent[] {
    return this.events.filter((e) => e.productId === productId);
  }

  getCount(): number {
    return this.events.length;
  }
}

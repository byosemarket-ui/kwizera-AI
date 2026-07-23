import fs from "node:fs";
import path from "node:path";
export class ProductHistoryStore {
    historyPath = null;
    events = [];
    initialize(productDir) {
        fs.mkdirSync(productDir, { recursive: true });
        this.historyPath = path.join(productDir, "product-history.jsonl");
        if (fs.existsSync(this.historyPath)) {
            const lines = fs.readFileSync(this.historyPath, "utf8").trim().split("\n").filter(Boolean);
            for (const line of lines) {
                this.events.push(JSON.parse(line));
            }
        }
    }
    append(event) {
        this.events.push(event);
        if (this.historyPath) {
            fs.appendFileSync(this.historyPath, `${JSON.stringify(event)}\n`, "utf8");
        }
    }
    getAll() {
        return this.events;
    }
    getByProduct(productId) {
        return this.events.filter((e) => e.productId === productId);
    }
    getCount() {
        return this.events.length;
    }
}
//# sourceMappingURL=product-history-store.js.map
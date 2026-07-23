import fs from "node:fs";
import path from "node:path";
export class ProductPatternStore {
    patternsPath = null;
    patterns = [];
    initialize(productDir) {
        fs.mkdirSync(productDir, { recursive: true });
        this.patternsPath = path.join(productDir, "product-patterns.jsonl");
        if (fs.existsSync(this.patternsPath)) {
            const lines = fs.readFileSync(this.patternsPath, "utf8").trim().split("\n").filter(Boolean);
            for (const line of lines) {
                this.patterns.push(JSON.parse(line));
            }
        }
    }
    store(pattern) {
        this.patterns.push(pattern);
        if (this.patternsPath) {
            fs.appendFileSync(this.patternsPath, `${JSON.stringify(pattern)}\n`, "utf8");
        }
    }
    getAll() {
        return this.patterns;
    }
    getReusable() {
        return this.patterns.filter((p) => p.reusable && p.confidence >= 60);
    }
    getCount() {
        return this.patterns.length;
    }
}
//# sourceMappingURL=product-pattern-store.js.map
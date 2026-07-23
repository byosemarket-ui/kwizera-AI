import fs from "node:fs";
import path from "node:path";
export class ProductPatternStore {
    storePath = "";
    patterns = [];
    initialize(productDir) {
        fs.mkdirSync(productDir, { recursive: true });
        this.storePath = path.join(productDir, "learned-patterns.json");
        if (fs.existsSync(this.storePath)) {
            this.patterns = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
        }
    }
    add(pattern) {
        if (this.patterns.some((p) => p.patternId === pattern.patternId))
            return;
        this.patterns.push(pattern);
        fs.writeFileSync(this.storePath, JSON.stringify(this.patterns, null, 2), "utf8");
    }
    getAll() {
        return [...this.patterns];
    }
    getCount() {
        return this.patterns.length;
    }
}
export class ProductRecordStore {
    storePath = "";
    records = new Map();
    initialize(productDir) {
        fs.mkdirSync(productDir, { recursive: true });
        this.storePath = path.join(productDir, "product-analysis-records.json");
        if (fs.existsSync(this.storePath)) {
            const data = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of data) {
                this.records.set(record.productId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.productId, record);
        fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
    }
    get(productId) {
        return this.records.get(productId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=product-stores.js.map
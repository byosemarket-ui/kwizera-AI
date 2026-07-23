import fs from "node:fs";
import path from "node:path";
export class BrandPatternStore {
    storePath = "";
    patterns = [];
    initialize(brandDir) {
        fs.mkdirSync(brandDir, { recursive: true });
        this.storePath = path.join(brandDir, "learned-patterns.json");
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
export class BrandRecordStore {
    storePath = "";
    records = new Map();
    initialize(brandDir) {
        fs.mkdirSync(brandDir, { recursive: true });
        this.storePath = path.join(brandDir, "brand-analysis-records.json");
        if (fs.existsSync(this.storePath)) {
            const data = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of data) {
                this.records.set(record.brandId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.brandId, record);
        fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
    }
    get(brandId) {
        return this.records.get(brandId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=brand-stores.js.map
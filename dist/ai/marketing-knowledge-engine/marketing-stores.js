import fs from "node:fs";
import path from "node:path";
export class MarketingPatternStore {
    storePath = "";
    patterns = [];
    initialize(marketingDir) {
        fs.mkdirSync(marketingDir, { recursive: true });
        this.storePath = path.join(marketingDir, "learned-patterns.json");
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
export class MarketingRecordStore {
    storePath = "";
    records = new Map();
    initialize(marketingDir) {
        fs.mkdirSync(marketingDir, { recursive: true });
        this.storePath = path.join(marketingDir, "marketing-analysis-records.json");
        if (fs.existsSync(this.storePath)) {
            const data = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of data) {
                this.records.set(record.campaignId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.campaignId, record);
        fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
    }
    get(campaignId) {
        return this.records.get(campaignId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=marketing-stores.js.map
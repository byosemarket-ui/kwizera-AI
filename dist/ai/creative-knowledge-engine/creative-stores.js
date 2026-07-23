import fs from "node:fs";
import path from "node:path";
export class CreativePatternStore {
    storePath = "";
    patterns = [];
    initialize(creativeDir) {
        fs.mkdirSync(creativeDir, { recursive: true });
        this.storePath = path.join(creativeDir, "learned-patterns.json");
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
export class CreativeRecordStore {
    storePath = "";
    records = new Map();
    initialize(creativeDir) {
        fs.mkdirSync(creativeDir, { recursive: true });
        this.storePath = path.join(creativeDir, "creative-analysis-records.json");
        if (fs.existsSync(this.storePath)) {
            const data = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of data) {
                this.records.set(record.creativeId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.creativeId, record);
        fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
    }
    get(creativeId) {
        return this.records.get(creativeId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=creative-stores.js.map
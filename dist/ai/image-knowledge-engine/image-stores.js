import fs from "node:fs";
import path from "node:path";
export class ImagePatternStore {
    storePath = "";
    patterns = [];
    initialize(imageDir) {
        fs.mkdirSync(imageDir, { recursive: true });
        this.storePath = path.join(imageDir, "learned-patterns.json");
        if (fs.existsSync(this.storePath)) {
            this.patterns = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
        }
    }
    add(pattern) {
        if (this.patterns.some((p) => p.patternId === pattern.patternId))
            return;
        this.patterns.push(pattern);
        this.persist();
    }
    getAll() {
        return [...this.patterns];
    }
    getCount() {
        return this.patterns.length;
    }
    persist() {
        fs.writeFileSync(this.storePath, JSON.stringify(this.patterns, null, 2), "utf8");
    }
}
export class ImageRecordStore {
    storePath = "";
    records = new Map();
    initialize(imageDir) {
        fs.mkdirSync(imageDir, { recursive: true });
        this.storePath = path.join(imageDir, "image-analysis-records.json");
        if (fs.existsSync(this.storePath)) {
            const data = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of data) {
                this.records.set(record.imageId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.imageId, record);
        this.persist();
    }
    get(imageId) {
        return this.records.get(imageId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
    persist() {
        fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
    }
}
//# sourceMappingURL=image-stores.js.map
import fs from "node:fs";
import path from "node:path";
export class VideoPatternStore {
    storePath = "";
    patterns = [];
    initialize(videoDir) {
        fs.mkdirSync(videoDir, { recursive: true });
        this.storePath = path.join(videoDir, "learned-patterns.json");
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
export class VideoRecordStore {
    storePath = "";
    records = new Map();
    initialize(videoDir) {
        fs.mkdirSync(videoDir, { recursive: true });
        this.storePath = path.join(videoDir, "video-analysis-records.json");
        if (fs.existsSync(this.storePath)) {
            const data = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of data) {
                this.records.set(record.videoId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.videoId, record);
        fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
    }
    get(videoId) {
        return this.records.get(videoId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=video-stores.js.map
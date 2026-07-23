import fs from "node:fs";
import path from "node:path";
export class VideoAnalysisRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "video-analysis-records.json");
        if (fs.existsSync(this.storePath)) {
            const raw = fs.readFileSync(this.storePath, "utf8");
            const list = JSON.parse(raw);
            for (const record of list) {
                this.records.set(record.videoId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.videoId, record);
        this.persist();
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
    persist() {
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
}
//# sourceMappingURL=video-analysis-stores.js.map
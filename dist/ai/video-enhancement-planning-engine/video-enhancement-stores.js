import fs from "node:fs";
import path from "node:path";
export class VideoEnhancementRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "video-enhancement-plans.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list)
                this.records.set(record.videoId, record);
        }
    }
    upsert(record) {
        this.records.set(record.videoId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
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
//# sourceMappingURL=video-enhancement-stores.js.map
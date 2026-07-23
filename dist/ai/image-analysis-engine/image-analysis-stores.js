import fs from "node:fs";
import path from "node:path";
export class ImageAnalysisRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "image-analysis-records.json");
        if (fs.existsSync(this.storePath)) {
            const raw = fs.readFileSync(this.storePath, "utf8");
            const list = JSON.parse(raw);
            for (const record of list) {
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
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
}
//# sourceMappingURL=image-analysis-stores.js.map
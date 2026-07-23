import fs from "node:fs";
import path from "node:path";
export class LightingColorIntelligenceRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "lighting-color-intelligence-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
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
//# sourceMappingURL=lighting-color-stores.js.map
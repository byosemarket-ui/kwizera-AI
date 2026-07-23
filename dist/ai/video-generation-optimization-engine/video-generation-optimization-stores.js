import fs from "node:fs";
import path from "node:path";
export class OptimizationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "optimization-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.optimizationId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.optimizationId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(optimizationId) {
        return this.records.get(optimizationId);
    }
    getByStoryboard(storyboardId) {
        return this.getAll().filter((r) => r.relationships.storyboards.includes(storyboardId));
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=video-generation-optimization-stores.js.map
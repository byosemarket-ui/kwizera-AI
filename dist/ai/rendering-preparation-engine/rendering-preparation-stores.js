import fs from "node:fs";
import path from "node:path";
export class RenderingPreparationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "rendering-preparation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.renderPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.renderPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(renderPlanId) {
        return this.records.get(renderPlanId);
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
//# sourceMappingURL=rendering-preparation-stores.js.map
import fs from "node:fs";
import path from "node:path";
export class AudioRenderRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "audio-render-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.audioRenderPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.audioRenderPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(audioRenderPlanId) {
        return this.records.get(audioRenderPlanId);
    }
    getByProduction(productionId) {
        return this.getAll().filter((r) => r.profile.productionId === productionId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.relationships.products.includes(productId));
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=audio-render-stores.js.map
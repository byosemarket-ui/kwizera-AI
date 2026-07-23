import fs from "node:fs";
import path from "node:path";
export class AmbientAudioGenerationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "ambient-audio-generation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.ambientPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.ambientPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(ambientPlanId) {
        return this.records.get(ambientPlanId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.relationships.products.includes(productId));
    }
    getByCategory(category) {
        return this.getAll().filter((r) => r.profile.environmentCategory === category);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=ambient-audio-generation-stores.js.map
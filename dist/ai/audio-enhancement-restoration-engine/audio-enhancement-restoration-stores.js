import fs from "node:fs";
import path from "node:path";
export class AudioEnhancementRestorationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "audio-enhancement-restoration-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.enhancementPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.enhancementPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(enhancementPlanId) {
        return this.records.get(enhancementPlanId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.relationships.products.includes(productId));
    }
    getByType(enhancementType) {
        return this.getAll().filter((r) => r.profile.enhancementType === enhancementType);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=audio-enhancement-restoration-stores.js.map
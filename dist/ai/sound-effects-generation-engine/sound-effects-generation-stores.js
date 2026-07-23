import fs from "node:fs";
import path from "node:path";
export class SoundEffectsGenerationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "sound-effects-generation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.soundPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.soundPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(soundPlanId) {
        return this.records.get(soundPlanId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.relationships.products.includes(productId));
    }
    getByCategory(category) {
        return this.getAll().filter((r) => r.profile.soundCategory === category);
    }
    getByProject(projectId) {
        return this.getAll().filter((r) => r.profile.projectId === projectId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=sound-effects-generation-stores.js.map
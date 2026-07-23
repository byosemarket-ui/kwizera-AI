import fs from "node:fs";
import path from "node:path";
export class AudioProductionRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "audio-production-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.audioProductionId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.audioProductionId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(audioProductionId) {
        return this.records.get(audioProductionId);
    }
    getByAudioPlan(audioPlanId) {
        return this.getAll().filter((r) => r.profile.audioPlanId === audioPlanId);
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
//# sourceMappingURL=audio-production-stores.js.map
import fs from "node:fs";
import path from "node:path";
export class AudioMixingMasteringRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "audio-mixing-mastering-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.mixingPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.mixingPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(mixingPlanId) {
        return this.records.get(mixingPlanId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.relationships.products.includes(productId));
    }
    getBySession(sessionId) {
        return this.getAll().filter((r) => r.profile.sessionId === sessionId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=audio-mixing-mastering-stores.js.map
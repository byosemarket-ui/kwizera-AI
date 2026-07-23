import fs from "node:fs";
import path from "node:path";
export class AudioPlanningRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "audio-planning-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.audioPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.audioPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(audioPlanId) {
        return this.records.get(audioPlanId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.productId === productId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=audio-planning-stores.js.map
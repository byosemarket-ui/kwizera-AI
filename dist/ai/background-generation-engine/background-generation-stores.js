import fs from "node:fs";
import path from "node:path";
export class BackgroundGenerationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "background-generation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.backgroundPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.backgroundPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(backgroundPlanId) {
        return this.records.get(backgroundPlanId);
    }
    getBySourceImage(sourceImageId) {
        return this.getAll().filter((r) => r.profile.sourceImageId === sourceImageId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.profile.productId === productId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=background-generation-stores.js.map
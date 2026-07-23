import fs from "node:fs";
import path from "node:path";
export class ImageProductionRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "image-production-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.imageProductionId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.imageProductionId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(imageProductionId) {
        return this.records.get(imageProductionId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.profile.productId === productId);
    }
    getByImagePlan(imagePlanId) {
        return this.getAll().filter((r) => r.profile.imagePlanId === imagePlanId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=image-production-stores.js.map
import fs from "node:fs";
import path from "node:path";
export class MultiStyleImageRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "multi-style-image-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.stylePlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.stylePlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(stylePlanId) {
        return this.records.get(stylePlanId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.profile.productId === productId);
    }
    getBySourceImage(sourceImageId) {
        return this.getAll().filter((r) => r.profile.sourceImageId === sourceImageId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=multi-style-image-stores.js.map
import fs from "node:fs";
import path from "node:path";
export class ImageEditingRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "image-editing-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.imageEditingPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.imageEditingPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(imageEditingPlanId) {
        return this.records.get(imageEditingPlanId);
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
//# sourceMappingURL=image-editing-stores.js.map
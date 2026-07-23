import fs from "node:fs";
import path from "node:path";
export class ProductImageGenerationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "product-image-generation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.productImagePlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.productImagePlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(productImagePlanId) {
        return this.records.get(productImagePlanId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.profile.productId === productId);
    }
    getByProject(projectId) {
        return this.getAll().filter((r) => r.profile.projectId === projectId);
    }
    getByCategory(productCategory) {
        return this.getAll().filter((r) => r.profile.productCategory === productCategory);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=product-image-generation-stores.js.map
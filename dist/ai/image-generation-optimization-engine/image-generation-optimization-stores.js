import fs from "node:fs";
import path from "node:path";
export class ImageGenerationOptimizationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "image-generation-optimization-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.optimizationId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.optimizationId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(optimizationId) {
        return this.records.get(optimizationId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.profile.productId === productId);
    }
    getByValidation(validationId) {
        return this.getAll().filter((r) => r.profile.validationId === validationId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=image-generation-optimization-stores.js.map
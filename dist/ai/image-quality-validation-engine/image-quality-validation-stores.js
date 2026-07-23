import fs from "node:fs";
import path from "node:path";
export class ImageQualityValidationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "image-quality-validation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.qualityValidationId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.qualityValidationId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(qualityValidationId) {
        return this.records.get(qualityValidationId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.profile.productId === productId);
    }
    getByRenderPlan(renderPlanId) {
        return this.getAll().filter((r) => r.profile.renderPlanId === renderPlanId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=image-quality-validation-stores.js.map
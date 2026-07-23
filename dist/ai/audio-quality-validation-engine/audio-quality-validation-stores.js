import fs from "node:fs";
import path from "node:path";
export class AudioQualityValidationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "audio-quality-validation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.audioQualityValidationId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.audioQualityValidationId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(audioQualityValidationId) {
        return this.records.get(audioQualityValidationId);
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
//# sourceMappingURL=audio-quality-validation-stores.js.map
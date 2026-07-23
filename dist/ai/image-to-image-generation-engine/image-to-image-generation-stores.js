import fs from "node:fs";
import path from "node:path";
export class ImageToImageGenerationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "image-to-image-generation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.transformationPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.transformationPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(transformationPlanId) {
        return this.records.get(transformationPlanId);
    }
    getBySourceImage(sourceImageId) {
        return this.getAll().filter((r) => r.profile.sourceImageId === sourceImageId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.profile.productId === productId);
    }
    getByProject(projectId) {
        return this.getAll().filter((r) => r.profile.projectId === projectId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=image-to-image-generation-stores.js.map
import fs from "node:fs";
import path from "node:path";
export class TextToImageGenerationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "text-to-image-generation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.imagePlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.imagePlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(imagePlanId) {
        return this.records.get(imagePlanId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.profile.productId === productId);
    }
    getByProject(projectId) {
        return this.getAll().filter((r) => r.profile.projectId === projectId);
    }
    getByPrompt(promptId) {
        return this.getAll().filter((r) => r.profile.promptId === promptId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=text-to-image-generation-stores.js.map
import fs from "node:fs";
import path from "node:path";
export class SceneGenerationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "scene-generation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.sceneId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.sceneId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(sceneId) {
        return this.records.get(sceneId);
    }
    getByStoryboard(storyboardId) {
        return this.getAll().filter((r) => r.profile.storyboardId === storyboardId);
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
//# sourceMappingURL=scene-generation-stores.js.map
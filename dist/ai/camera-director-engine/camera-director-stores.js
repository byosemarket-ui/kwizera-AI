import fs from "node:fs";
import path from "node:path";
export class CameraDirectorRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "camera-director-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.cameraPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.cameraPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(cameraPlanId) {
        return this.records.get(cameraPlanId);
    }
    getByScene(sceneId) {
        return this.getAll().filter((r) => r.profile.sceneId === sceneId);
    }
    getByStoryboard(storyboardId) {
        return this.getAll().filter((r) => r.profile.storyboardId === storyboardId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.relationships.products.includes(productId));
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=camera-director-stores.js.map
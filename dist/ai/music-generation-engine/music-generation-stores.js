import fs from "node:fs";
import path from "node:path";
export class MusicGenerationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "music-generation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.musicPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.musicPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(musicPlanId) {
        return this.records.get(musicPlanId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.relationships.products.includes(productId));
    }
    getByGenre(genre) {
        return this.getAll().filter((r) => r.profile.genre === genre);
    }
    getByMood(mood) {
        return this.getAll().filter((r) => r.profile.mood === mood);
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
//# sourceMappingURL=music-generation-stores.js.map
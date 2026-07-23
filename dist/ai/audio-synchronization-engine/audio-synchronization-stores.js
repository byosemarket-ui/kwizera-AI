import fs from "node:fs";
import path from "node:path";
export class AudioSynchronizationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "audio-synchronization-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.audioSynchronizationId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.audioSynchronizationId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(audioSynchronizationId) {
        return this.records.get(audioSynchronizationId);
    }
    getByScene(sceneId) {
        return this.getAll().filter((r) => r.profile.sceneId === sceneId);
    }
    getByStoryboard(storyboardId) {
        return this.getAll().filter((r) => r.profile.storyboardId === storyboardId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=audio-synchronization-stores.js.map
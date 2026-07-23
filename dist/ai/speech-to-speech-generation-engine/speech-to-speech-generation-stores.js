import fs from "node:fs";
import path from "node:path";
export class SpeechToSpeechGenerationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "speech-to-speech-generation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.transformationId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.transformationId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(transformationId) {
        return this.records.get(transformationId);
    }
    getBySourceAudio(sourceAudioId) {
        return this.getAll().filter((r) => r.profile.sourceAudioId === sourceAudioId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.relationships.products.includes(productId));
    }
    getByProject(projectId) {
        return this.getAll().filter((r) => r.profile.projectId === projectId);
    }
    getByLanguage(language) {
        return this.getAll().filter((r) => r.profile.language === language);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=speech-to-speech-generation-stores.js.map
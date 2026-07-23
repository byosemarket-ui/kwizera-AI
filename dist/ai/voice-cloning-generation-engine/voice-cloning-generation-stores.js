import fs from "node:fs";
import path from "node:path";
export class VoiceCloningGenerationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "voice-cloning-generation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.cloningPlanId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.cloningPlanId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(cloningPlanId) {
        return this.records.get(cloningPlanId);
    }
    getByVoiceSample(voiceSampleId) {
        return this.getAll().filter((r) => r.profile.sampleId === voiceSampleId);
    }
    getBySpeaker(speakerId) {
        return this.getAll().filter((r) => r.profile.speakerId === speakerId);
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
//# sourceMappingURL=voice-cloning-generation-stores.js.map
import fs from "node:fs";
import path from "node:path";
export class StoryGenerationRecordStore {
    storePath = "";
    records = new Map();
    initialize(engineDir) {
        fs.mkdirSync(engineDir, { recursive: true });
        this.storePath = path.join(engineDir, "story-generation-records.json");
        if (fs.existsSync(this.storePath)) {
            const list = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of list) {
                this.records.set(record.storyboardId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.storyboardId, record);
        fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
    }
    get(storyboardId) {
        return this.records.get(storyboardId);
    }
    getByProduct(productId) {
        return this.getAll().filter((r) => r.profile.productId === productId);
    }
    getByProject(projectId) {
        return this.getAll().filter((r) => r.profile.projectId === projectId);
    }
    getByCampaign(campaignId) {
        return this.getAll().filter((r) => r.profile.campaignId === campaignId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=story-generation-stores.js.map
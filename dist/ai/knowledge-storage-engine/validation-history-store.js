import fs from "node:fs";
import path from "node:path";
export class KnowledgeValidationHistoryStore {
    logger;
    historyPath = "";
    entries = [];
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storageDir) {
        fs.mkdirSync(storageDir, { recursive: true });
        this.historyPath = path.join(storageDir, "validation-history.json");
        if (fs.existsSync(this.historyPath)) {
            const raw = fs.readFileSync(this.historyPath, "utf8");
            this.entries = JSON.parse(raw);
        }
    }
    append(entry) {
        this.entries.push(entry);
        fs.writeFileSync(this.historyPath, JSON.stringify(this.entries, null, 2), "utf8");
        this.logger.log("debug", "validation", "Validation history recorded", {
            knowledgeId: entry.knowledgeId,
            valid: entry.valid,
        });
    }
    getAll() {
        return [...this.entries];
    }
    getCount() {
        return this.entries.length;
    }
}
//# sourceMappingURL=validation-history-store.js.map
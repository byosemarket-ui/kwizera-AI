import fs from "node:fs";
import path from "node:path";
export class LearningHistoryStore {
    historyPath = null;
    records = [];
    initialize(learningDir) {
        fs.mkdirSync(learningDir, { recursive: true });
        this.historyPath = path.join(learningDir, "learning-history.jsonl");
        if (fs.existsSync(this.historyPath)) {
            const lines = fs.readFileSync(this.historyPath, "utf8").trim().split("\n").filter(Boolean);
            for (const line of lines) {
                this.records.push(JSON.parse(line));
            }
        }
    }
    append(record) {
        this.records.push(record);
        if (this.historyPath) {
            fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
        }
    }
    getAll() {
        return this.records;
    }
    getCount() {
        return this.records.length;
    }
    findById(learningId) {
        return this.records.find((r) => r.learningId === learningId);
    }
    getByProject(projectId) {
        return this.records.filter((r) => r.relatedProject === projectId);
    }
    getHistoryPath() {
        return this.historyPath;
    }
}
//# sourceMappingURL=learning-history-store.js.map
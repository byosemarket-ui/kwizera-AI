import fs from "node:fs";
import path from "node:path";
export class ReasoningHistoryStore {
    historyPath = null;
    records = [];
    initialize(reasoningDirectory) {
        fs.mkdirSync(reasoningDirectory, { recursive: true });
        this.historyPath = path.join(reasoningDirectory, "reasoning-history.jsonl");
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
    getHistoryPath() {
        return this.historyPath;
    }
}
//# sourceMappingURL=reasoning-history-store.js.map
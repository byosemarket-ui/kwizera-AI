import fs from "node:fs";
import path from "node:path";
export class DecisionHistoryStore {
    historyPath = null;
    records = [];
    initialize(decisionsDirectory) {
        fs.mkdirSync(decisionsDirectory, { recursive: true });
        this.historyPath = path.join(decisionsDirectory, "decision-history.jsonl");
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
//# sourceMappingURL=decision-history-store.js.map
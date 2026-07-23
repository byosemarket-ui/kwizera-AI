import fs from "node:fs";
import path from "node:path";
export class StateHistoryStore {
    historyPath = null;
    records = [];
    initialize(stateDirectory) {
        fs.mkdirSync(stateDirectory, { recursive: true });
        this.historyPath = path.join(stateDirectory, "state-history.jsonl");
    }
    append(record) {
        this.records.push(record);
        if (this.historyPath) {
            fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
        }
    }
    getRecords() {
        return this.records;
    }
    getCount() {
        return this.records.length;
    }
    getHistoryPath() {
        return this.historyPath;
    }
}
//# sourceMappingURL=state-history-store.js.map
import fs from "node:fs";
import path from "node:path";
export class PlanningHistoryStore {
    historyPath = null;
    records = [];
    initialize(plansDirectory) {
        fs.mkdirSync(plansDirectory, { recursive: true });
        this.historyPath = path.join(plansDirectory, "planning-history.jsonl");
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
//# sourceMappingURL=planning-history-store.js.map
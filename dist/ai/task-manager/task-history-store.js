import fs from "node:fs";
import path from "node:path";
export class TaskHistoryStore {
    historyPath = null;
    records = [];
    initialize(tasksDirectory) {
        fs.mkdirSync(tasksDirectory, { recursive: true });
        this.historyPath = path.join(tasksDirectory, "task-history.jsonl");
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
//# sourceMappingURL=task-history-store.js.map
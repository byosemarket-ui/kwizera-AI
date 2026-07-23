import fs from "node:fs";
import path from "node:path";
export class WorkflowHistoryStore {
    historyPath = null;
    records = [];
    initialize(workflowsDirectory) {
        fs.mkdirSync(workflowsDirectory, { recursive: true });
        this.historyPath = path.join(workflowsDirectory, "workflow-history.jsonl");
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
//# sourceMappingURL=workflow-history-store.js.map
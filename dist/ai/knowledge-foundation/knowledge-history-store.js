import fs from "node:fs";
import path from "node:path";
export class KnowledgeHistoryStore {
    historyPath = null;
    records = [];
    initialize(knowledgeDirectory) {
        const historyDir = path.join(knowledgeDirectory, "history");
        fs.mkdirSync(historyDir, { recursive: true });
        this.historyPath = path.join(historyDir, "knowledge-history.jsonl");
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
//# sourceMappingURL=knowledge-history-store.js.map
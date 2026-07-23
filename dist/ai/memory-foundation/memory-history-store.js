import fs from "node:fs";
import path from "node:path";
export class MemoryHistoryStore {
    historyPath = null;
    records = [];
    initialize(memoryDirectory) {
        const historyDir = path.join(memoryDirectory, "history");
        fs.mkdirSync(historyDir, { recursive: true });
        this.historyPath = path.join(historyDir, "memory-history.jsonl");
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
//# sourceMappingURL=memory-history-store.js.map
import fs from "node:fs";
import path from "node:path";
export class MessageHistoryStore {
    historyPath = null;
    records = [];
    initialize(communicationsDirectory) {
        fs.mkdirSync(communicationsDirectory, { recursive: true });
        this.historyPath = path.join(communicationsDirectory, "message-history.jsonl");
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
//# sourceMappingURL=message-history-store.js.map
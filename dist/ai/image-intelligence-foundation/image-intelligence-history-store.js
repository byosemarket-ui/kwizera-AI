import fs from "node:fs";
import path from "node:path";
export class ImageIntelligenceHistoryStore {
    historyPath = null;
    records = [];
    initialize(intelligenceDirectory) {
        const historyDir = path.join(intelligenceDirectory, "history");
        fs.mkdirSync(historyDir, { recursive: true });
        this.historyPath = path.join(historyDir, "image-intelligence-history.jsonl");
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
}
//# sourceMappingURL=image-intelligence-history-store.js.map
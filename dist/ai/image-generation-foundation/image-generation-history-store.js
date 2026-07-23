import fs from "node:fs";
import path from "node:path";
export class ImageGenerationHistoryStore {
    historyPath = null;
    records = [];
    initialize(generationDirectory) {
        const historyDir = path.join(generationDirectory, "history");
        fs.mkdirSync(historyDir, { recursive: true });
        this.historyPath = path.join(historyDir, "image-generation-history.jsonl");
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
//# sourceMappingURL=image-generation-history-store.js.map
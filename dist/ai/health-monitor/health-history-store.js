import fs from "node:fs";
import path from "node:path";
export class HealthHistoryStore {
    historyPath = null;
    records = [];
    initialize(healthDirectory) {
        fs.mkdirSync(healthDirectory, { recursive: true });
        this.historyPath = path.join(healthDirectory, "health-history.jsonl");
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
    getPerformanceTrends() {
        return this.records.map((r) => ({
            timestamp: r.timestamp,
            score: r.healthScore,
        }));
    }
}
//# sourceMappingURL=health-history-store.js.map
import fs from "node:fs";
import path from "node:path";
export class RecoveryHistoryStore {
    historyPath = null;
    records = [];
    initialize(recoveryDirectory) {
        fs.mkdirSync(recoveryDirectory, { recursive: true });
        this.historyPath = path.join(recoveryDirectory, "recovery-history.jsonl");
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
    getSuccessRate() {
        if (this.records.length === 0)
            return 100;
        const successes = this.records.filter((r) => r.result === "success").length;
        return Math.round((successes / this.records.length) * 100);
    }
    getHistoryPath() {
        return this.historyPath;
    }
}
//# sourceMappingURL=recovery-history-store.js.map
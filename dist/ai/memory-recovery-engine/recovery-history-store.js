import fs from "node:fs";
import path from "node:path";
export class RecoveryHistoryStore {
    historyPath = "";
    entries = [];
    initialize(recoveryDir) {
        fs.mkdirSync(recoveryDir, { recursive: true });
        this.historyPath = path.join(recoveryDir, "recovery-history.json");
        if (fs.existsSync(this.historyPath)) {
            this.entries = JSON.parse(fs.readFileSync(this.historyPath, "utf8"));
        }
    }
    append(entry) {
        this.entries.push(entry);
        this.persist();
    }
    getAll() {
        return [...this.entries];
    }
    getSuccessRate() {
        if (this.entries.length === 0)
            return 100;
        const successful = this.entries.filter((e) => e.success).length;
        return Math.round((successful / this.entries.length) * 100);
    }
    persist() {
        fs.writeFileSync(this.historyPath, JSON.stringify(this.entries, null, 2), "utf8");
    }
}
//# sourceMappingURL=recovery-history-store.js.map
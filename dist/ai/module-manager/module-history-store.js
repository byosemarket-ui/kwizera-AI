import fs from "node:fs";
import path from "node:path";
export class ModuleHistoryStore {
    historyPath = null;
    events = [];
    performance = [];
    initialize(modulesDirectory) {
        fs.mkdirSync(modulesDirectory, { recursive: true });
        this.historyPath = path.join(modulesDirectory, "module-history.jsonl");
    }
    appendEvent(event) {
        this.events.push(event);
        if (this.historyPath) {
            fs.appendFileSync(this.historyPath, `${JSON.stringify({ type: "event", ...event })}\n`, "utf8");
        }
    }
    appendPerformance(stats) {
        this.performance.push(stats);
        if (this.historyPath) {
            fs.appendFileSync(this.historyPath, `${JSON.stringify({ type: "performance", ...stats })}\n`, "utf8");
        }
    }
    getEvents() {
        return this.events;
    }
    getPerformance() {
        return this.performance;
    }
    getHistoryPath() {
        return this.historyPath;
    }
}
//# sourceMappingURL=module-history-store.js.map
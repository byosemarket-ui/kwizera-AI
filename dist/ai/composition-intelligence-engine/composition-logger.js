import fs from "node:fs";
import path from "node:path";
export class CompositionLogger {
    logFilePath = null;
    entries = [];
    initialize(logDirectory) {
        fs.mkdirSync(logDirectory, { recursive: true });
        const date = new Date().toISOString().slice(0, 10);
        this.logFilePath = path.join(logDirectory, `composition-intelligence-${date}.jsonl`);
    }
    log(level, event, message, data) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            event,
            message,
            data,
        };
        this.entries.push(entry);
        if (this.logFilePath) {
            fs.appendFileSync(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");
        }
    }
    getLogFilePath() {
        return this.logFilePath;
    }
}
//# sourceMappingURL=composition-logger.js.map
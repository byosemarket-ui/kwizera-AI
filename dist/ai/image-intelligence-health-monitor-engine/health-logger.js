import fs from "node:fs";
import path from "node:path";
export class ImageIntelligenceHealthMonitorLogger {
    logDirectory = null;
    logFilePath = null;
    initialize(logDirectory) {
        fs.mkdirSync(logDirectory, { recursive: true });
        this.logDirectory = logDirectory;
        const date = new Date().toISOString().slice(0, 10);
        this.logFilePath = path.join(logDirectory, `image-intelligence-health-monitor-engine-${date}.jsonl`);
    }
    log(level, event, message, data) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            event,
            message,
            data,
        };
        if (this.logFilePath) {
            fs.appendFileSync(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");
        }
    }
    getLogDirectory() {
        return this.logDirectory;
    }
}
//# sourceMappingURL=health-logger.js.map
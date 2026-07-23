import fs from "node:fs";
import path from "node:path";
export class AudioGenerationFoundationLogger {
    logDirectory = null;
    logFilePath = null;
    entries = [];
    initialize(logDirectory) {
        fs.mkdirSync(logDirectory, { recursive: true });
        this.logDirectory = logDirectory;
        const date = new Date().toISOString().slice(0, 10);
        this.logFilePath = path.join(logDirectory, `audio-generation-foundation-${date}.jsonl`);
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
    getEntries() {
        return this.entries;
    }
    getLogDirectory() {
        return this.logDirectory;
    }
    getLogFilePath() {
        return this.logFilePath;
    }
}
//# sourceMappingURL=audio-generation-logger.js.map
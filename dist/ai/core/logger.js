import fs from "node:fs";
import path from "node:path";
const LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
export class AiCoreLogger {
    entries = [];
    minLevel = "info";
    logDirectory = null;
    logFilePath = null;
    correlationId;
    initialized = false;
    configure(options) {
        this.logDirectory = options.logDirectory;
        this.minLevel = options.minLevel;
        this.correlationId = options.correlationId;
        fs.mkdirSync(options.logDirectory, { recursive: true });
        const date = new Date().toISOString().slice(0, 10);
        this.logFilePath = path.join(options.logDirectory, `ai-core-${date}.jsonl`);
        this.initialized = true;
    }
    isInitialized() {
        return this.initialized;
    }
    getLogDirectory() {
        return this.logDirectory;
    }
    getLogFilePath() {
        return this.logFilePath;
    }
    getEntries() {
        return this.entries;
    }
    log(level, category, message, data) {
        if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) {
            return;
        }
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            correlationId: this.correlationId,
            data,
        };
        this.entries.push(entry);
        if (this.logFilePath) {
            fs.appendFileSync(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");
        }
    }
    debug(category, message, data) {
        this.log("debug", category, message, data);
    }
    info(category, message, data) {
        this.log("info", category, message, data);
    }
    warn(category, message, data) {
        this.log("warn", category, message, data);
    }
    error(category, message, data) {
        this.log("error", category, message, data);
    }
    flush() {
        // appendFileSync is synchronous — nothing extra required for Step 2A
    }
}
//# sourceMappingURL=logger.js.map
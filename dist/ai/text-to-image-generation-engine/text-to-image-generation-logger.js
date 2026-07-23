import fs from "node:fs";
import path from "node:path";
export class TextToImageGenerationLogger {
    logFilePath = null;
    initialize(logDirectory) {
        fs.mkdirSync(logDirectory, { recursive: true });
        const date = new Date().toISOString().slice(0, 10);
        this.logFilePath = path.join(logDirectory, `text-to-image-generation-engine-${date}.jsonl`);
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
    getLogFilePath() {
        return this.logFilePath;
    }
}
//# sourceMappingURL=text-to-image-generation-logger.js.map
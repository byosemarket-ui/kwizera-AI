import fs from "node:fs";
import path from "node:path";
export class VideoPatternStore {
    patternsPath = null;
    patterns = [];
    initialize(videoDir) {
        fs.mkdirSync(videoDir, { recursive: true });
        this.patternsPath = path.join(videoDir, "video-patterns.jsonl");
        if (fs.existsSync(this.patternsPath)) {
            const lines = fs.readFileSync(this.patternsPath, "utf8").trim().split("\n").filter(Boolean);
            for (const line of lines) {
                this.patterns.push(JSON.parse(line));
            }
        }
    }
    store(pattern) {
        this.patterns.push(pattern);
        if (this.patternsPath) {
            fs.appendFileSync(this.patternsPath, `${JSON.stringify(pattern)}\n`, "utf8");
        }
    }
    getAll() {
        return this.patterns;
    }
    getByType(type) {
        return this.patterns.filter((p) => p.patternType === type);
    }
    getByVideo(videoId) {
        return this.patterns.filter((p) => p.sourceVideoId === videoId);
    }
    getReusable() {
        return this.patterns.filter((p) => p.reusable && p.confidence >= 60);
    }
    getCount() {
        return this.patterns.length;
    }
}
//# sourceMappingURL=video-pattern-store.js.map
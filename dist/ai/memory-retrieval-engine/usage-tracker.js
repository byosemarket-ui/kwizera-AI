import fs from "node:fs";
import path from "node:path";
export class UsageTracker {
    logger;
    statsPath = "";
    stats = new Map();
    constructor(logger) {
        this.logger = logger;
    }
    initialize(retrievalDir) {
        fs.mkdirSync(retrievalDir, { recursive: true });
        this.statsPath = path.join(retrievalDir, "usage-stats.json");
        if (fs.existsSync(this.statsPath)) {
            const raw = fs.readFileSync(this.statsPath, "utf8");
            const data = JSON.parse(raw);
            for (const stat of data) {
                this.stats.set(stat.memoryId, stat);
            }
        }
    }
    recordAccess(memoryId) {
        const existing = this.stats.get(memoryId);
        const stat = {
            memoryId,
            accessCount: (existing?.accessCount ?? 0) + 1,
            lastAccessTime: new Date().toISOString(),
        };
        this.stats.set(memoryId, stat);
        this.persist();
        return stat;
    }
    getStat(memoryId) {
        return (this.stats.get(memoryId) ?? {
            memoryId,
            accessCount: 0,
            lastAccessTime: new Date(0).toISOString(),
        });
    }
    getAllStats() {
        return [...this.stats.values()];
    }
    persist() {
        fs.writeFileSync(this.statsPath, JSON.stringify([...this.stats.values()], null, 2), "utf8");
    }
}
//# sourceMappingURL=usage-tracker.js.map
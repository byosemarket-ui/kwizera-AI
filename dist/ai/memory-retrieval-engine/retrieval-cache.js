const MAX_CACHE_SIZE = 100;
export class RetrievalCache {
    logger;
    cache = new Map();
    hits = 0;
    misses = 0;
    constructor(logger) {
        this.logger = logger;
    }
    get(memoryId, indexEntry) {
        const entry = this.cache.get(memoryId);
        if (!entry) {
            this.misses++;
            return null;
        }
        if (indexEntry && (indexEntry.version !== entry.indexVersion || indexEntry.lastUpdate !== entry.lastUpdate)) {
            this.cache.delete(memoryId);
            this.misses++;
            this.logger.log("debug", "cache", "Cache entry invalidated", { memoryId });
            return null;
        }
        this.hits++;
        return entry.record;
    }
    set(memoryId, record, indexEntry) {
        if (this.cache.size >= MAX_CACHE_SIZE) {
            const oldest = [...this.cache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0];
            if (oldest)
                this.cache.delete(oldest[0]);
        }
        this.cache.set(memoryId, {
            record,
            indexVersion: indexEntry?.version ?? record.version,
            lastUpdate: indexEntry?.lastUpdate ?? record.lastUpdate,
            cachedAt: Date.now(),
        });
    }
    invalidate(memoryId) {
        this.cache.delete(memoryId);
    }
    clear() {
        this.cache.clear();
    }
    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? Math.round((this.hits / total) * 100) : 0,
        };
    }
}
//# sourceMappingURL=retrieval-cache.js.map
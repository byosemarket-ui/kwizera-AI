const MAX_CACHE_SIZE = 100;
export class KnowledgeRetrievalCache {
    logger;
    cache = new Map();
    hits = 0;
    misses = 0;
    constructor(logger) {
        this.logger = logger;
    }
    get(knowledgeId, indexEntry) {
        const entry = this.cache.get(knowledgeId);
        if (!entry) {
            this.misses++;
            return null;
        }
        if (indexEntry &&
            (indexEntry.version !== entry.indexVersion || indexEntry.lastUpdated !== entry.lastUpdated)) {
            this.cache.delete(knowledgeId);
            this.misses++;
            this.logger.log("debug", "cache", "Cache entry invalidated", { knowledgeId });
            return null;
        }
        this.hits++;
        return entry.record;
    }
    set(knowledgeId, record, indexEntry) {
        if (this.cache.size >= MAX_CACHE_SIZE) {
            const oldest = [...this.cache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0];
            if (oldest)
                this.cache.delete(oldest[0]);
        }
        this.cache.set(knowledgeId, {
            record,
            indexVersion: indexEntry?.version ?? record.version,
            lastUpdated: indexEntry?.lastUpdated ?? record.lastUpdated,
            cachedAt: Date.now(),
        });
    }
    invalidate(knowledgeId) {
        this.cache.delete(knowledgeId);
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
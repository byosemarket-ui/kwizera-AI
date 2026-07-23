import path from "node:path";
import { SearchQueryBuilder } from "./search-query-builder.js";
import { ResultRanker } from "./result-ranker.js";
import { RelatedMemoryFinder } from "./related-memory-finder.js";
import { RetrievalValidator } from "./retrieval-validator.js";
import { RetrievalCache } from "./retrieval-cache.js";
import { UsageTracker } from "./usage-tracker.js";
import { MemoryRetrievalLogger } from "./retrieval-logger.js";
import { MemoryRetrievalEngineError, SearchMode, } from "./types.js";
/**
 * Memory Retrieval Engine — intelligently finds, retrieves and delivers stored memory.
 */
export class AiMemoryRetrievalEngine {
    foundation = null;
    storageEngine = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    logger = new MemoryRetrievalLogger();
    queryBuilder = new SearchQueryBuilder();
    usageTracker = new UsageTracker(this.logger);
    cache = new RetrievalCache(this.logger);
    ranker = null;
    relatedFinder = null;
    validator = null;
    indexEngine = null;
    searchTimes = [];
    retrievalTimes = [];
    totalSearches = 0;
    totalRetrievals = 0;
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageEngine = foundation.getStorageEngine();
        this.indexEngine = foundation.getIndexEngine();
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        const retrievalDir = path.join(storageRoot, "memory", "retrieval");
        this.logger.initialize(logDir);
        this.usageTracker.initialize(retrievalDir);
        this.ranker = new ResultRanker(this.usageTracker);
        this.relatedFinder = new RelatedMemoryFinder(this.ranker, this.logger);
        this.validator = new RetrievalValidator(this.logger, this.storageEngine);
        this.initialized = true;
        this.logger.log("info", "startup", "Memory Retrieval Engine initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        this.startupComplete = true;
        this.logger.log("info", "startup", "Memory Retrieval Engine startup complete", {
            indexedRecords: this.storageEngine.getRecordCount(),
        });
    }
    async search(query) {
        this.ensureReady();
        const searchStart = Date.now();
        this.totalSearches++;
        const mode = query.mode ?? SearchMode.Hybrid;
        const requesterId = query.requesterId ?? "memory-retrieval-engine";
        const diagnostics = [];
        const allEntries = this.storageEngine.getIndexEntries();
        let candidates = this.queryBuilder.filterCandidates(allEntries, query);
        const indexLookup = this.indexEngine?.lookup({
            mode: query.mode,
            memoryId: query.memoryId,
            project: query.project,
            category: query.category,
            tags: query.tags,
            keywords: query.keywords,
            workflow: query.workflow,
            text: query.text,
            relatedTo: query.relatedTo,
            limit: query.limit,
        });
        if (indexLookup && indexLookup.memoryIds.length > 0) {
            const idSet = new Set(indexLookup.memoryIds);
            const indexed = allEntries.filter((e) => idSet.has(e.memoryId));
            if (indexed.length > 0) {
                candidates = indexed;
            }
        }
        const ranked = this.ranker.rank(candidates, query, query.relatedTo);
        const retrievalStart = Date.now();
        const results = [];
        let fromCache = false;
        for (const rankedResult of ranked) {
            const hydrated = await this.hydrateResult(rankedResult, requesterId);
            if (hydrated) {
                results.push(hydrated);
                if (hydrated.record)
                    fromCache = fromCache || this.wasFromCache(rankedResult.memoryId);
            }
            else {
                diagnostics.push(`Failed to retrieve: ${rankedResult.memoryId}`);
            }
        }
        const retrievalMs = Date.now() - retrievalStart;
        this.retrievalTimes.push(retrievalMs);
        const searchMs = Date.now() - searchStart;
        this.searchTimes.push(searchMs);
        const relatedMemories = [];
        const recommendations = [];
        if (results.length > 0 && results[0].record) {
            relatedMemories.push(...this.relatedFinder.findRelated(results[0].record, allEntries, 5));
            recommendations.push(...this.relatedFinder.recommend({ text: query.text, project: query.project, workflow: query.workflow }, allEntries, results.map((r) => r.memoryId), 5));
        }
        this.logger.log("info", "search", "Memory search complete", {
            mode,
            candidates: candidates.length,
            results: results.length,
            searchMs,
            retrievalMs,
        });
        return {
            success: results.length > 0 || candidates.length === 0,
            mode,
            results,
            relatedMemories,
            recommendations,
            searchMs,
            retrievalMs,
            totalCandidates: candidates.length,
            fromCache,
            diagnostics,
        };
    }
    async retrieve(memoryId, requesterId = "memory-retrieval-engine") {
        this.ensureReady();
        const start = Date.now();
        this.totalRetrievals++;
        const validation = await this.validator.validateForRetrieval(memoryId, requesterId);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Retrieval validation failed", {
                memoryId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                memoryId,
                retrievalMs: Date.now() - start,
                fromCache: false,
                diagnostics: validation.diagnostics,
                recoverySuggestion: validation.recoverySuggestion,
                relatedMemories: [],
                recommendations: [],
            };
        }
        const indexEntry = this.storageEngine.findIndexEntry(memoryId);
        let fromCache = false;
        let record = this.cache.get(memoryId, indexEntry);
        if (record) {
            fromCache = true;
        }
        else {
            const read = await this.storageEngine.getRecord(memoryId, requesterId);
            record = read.record;
            this.cache.set(memoryId, record, indexEntry);
        }
        this.usageTracker.recordAccess(memoryId);
        const allEntries = this.storageEngine.getIndexEntries();
        const relatedMemories = this.relatedFinder.findRelated(record, allEntries, 8);
        const recommendations = this.relatedFinder.recommend({ text: record.title, project: record.relatedProject, workflow: record.relatedWorkflow }, allEntries, [memoryId, ...relatedMemories.map((r) => r.memoryId)], 5);
        const retrievalMs = Date.now() - start;
        this.retrievalTimes.push(retrievalMs);
        this.logger.log("info", "retrieve", "Memory retrieved", {
            memoryId,
            retrievalMs,
            fromCache,
            related: relatedMemories.length,
        });
        return {
            success: true,
            memoryId,
            record,
            relatedMemories,
            recommendations,
            retrievalMs,
            fromCache,
            diagnostics: [],
        };
    }
    invalidateCache(memoryId) {
        if (memoryId) {
            this.cache.invalidate(memoryId);
        }
        else {
            this.cache.clear();
        }
    }
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const cacheStats = this.cache.getStats();
        const knownIssues = [];
        if (!this.storageEngine?.isStorageAvailable()) {
            knownIssues.push("Storage unavailable for retrieval");
        }
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.storageEngine?.isStorageAvailable())
            readinessScore -= 20;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            searchPerformance: {
                averageSearchMs: avg(this.searchTimes),
                averageRetrievalMs: avg(this.retrievalTimes),
                lastSearchMs: this.searchTimes[this.searchTimes.length - 1] ?? 0,
                lastRetrievalMs: this.retrievalTimes[this.retrievalTimes.length - 1] ?? 0,
            },
            rankingQuality: "multi-factor composite scoring active",
            cacheStatus: cacheStats,
            validationStatus: "pre-retrieval integrity validation active",
            totalSearches: this.totalSearches,
            totalRetrievals: this.totalRetrievals,
            knownIssues,
            readinessScore: Math.max(0, readinessScore),
            timestamp: new Date().toISOString(),
        };
    }
    async hydrateResult(ranked, requesterId) {
        const validation = await this.validator.validateForRetrieval(ranked.memoryId, requesterId);
        if (!validation.valid)
            return null;
        const indexEntry = this.storageEngine.findIndexEntry(ranked.memoryId);
        let record = this.cache.get(ranked.memoryId, indexEntry);
        if (!record) {
            const read = await this.storageEngine.getRecord(ranked.memoryId, requesterId);
            if (!read.success || !read.record)
                return null;
            record = read.record;
            this.cache.set(ranked.memoryId, record, indexEntry);
        }
        this.usageTracker.recordAccess(ranked.memoryId);
        return { ...ranked, record };
    }
    wasFromCache(memoryId) {
        return this.cache.getStats().hits > 0 && Boolean(this.cache.get(memoryId));
    }
    ensureReady() {
        if (!this.initialized || !this.storageEngine || !this.foundation) {
            throw new MemoryRetrievalEngineError("Memory Retrieval Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=memory-retrieval-engine.js.map
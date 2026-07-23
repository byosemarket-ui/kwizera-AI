import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { InvertedIndexStore } from "./inverted-index-store.js";
import { RelationshipIndex } from "./relationship-index.js";
import { IndexBuilder } from "./index-builder.js";
import { IndexLookup } from "./index-lookup.js";
import { IndexHealthChecker } from "./index-health-checker.js";
import { IndexRebuilder } from "./index-rebuilder.js";
import { IndexOptimizer } from "./index-optimizer.js";
import { MemoryIndexLogger } from "./index-logger.js";
import { IndexType, MemoryIndexEngineError, } from "./types.js";
/**
 * Memory Index Engine — organizes stored memory into intelligent indexes for fast retrieval.
 */
export class AiMemoryIndexEngine {
    foundation = null;
    storageEngine = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    lastHealth = null;
    logger = new MemoryIndexLogger();
    invertedStore = new InvertedIndexStore(this.logger);
    relationshipIndex = new RelationshipIndex(this.logger);
    indexBuilder = null;
    indexLookup = null;
    healthChecker = null;
    rebuilder = null;
    optimizer = null;
    indexTimes = [];
    lookupTimes = [];
    totalIndexed = 0;
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageEngine = foundation.getStorageEngine();
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        const indexesDir = path.join(storageRoot, "memory", "indexes");
        this.logger.initialize(logDir);
        this.invertedStore.initialize(indexesDir);
        this.relationshipIndex.initialize(indexesDir);
        this.indexBuilder = new IndexBuilder(this.invertedStore, this.relationshipIndex, this.logger);
        this.indexLookup = new IndexLookup(this.invertedStore, this.relationshipIndex);
        this.healthChecker = new IndexHealthChecker(this.invertedStore, this.relationshipIndex, this.logger);
        this.rebuilder = new IndexRebuilder(this.invertedStore, this.relationshipIndex, this.indexBuilder, this.logger);
        this.optimizer = new IndexOptimizer(this.invertedStore, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Memory Index Engine initialized", { indexesDir });
    }
    async runStartup() {
        this.ensureReady();
        const recordIds = this.storageEngine.getIndexEntries().map((e) => e.memoryId);
        this.lastHealth = this.healthChecker.runCheck(recordIds);
        if (!this.lastHealth.healthy || recordIds.length > 0) {
            const idIndex = this.invertedStore.getIndex(IndexType.MemoryId);
            if (idIndex.entryCount < recordIds.length) {
                await this.rebuildIndexes();
            }
        }
        this.optimizer.optimize();
        this.writeManifest();
        this.startupComplete = true;
        this.logger.log("info", "startup", "Memory Index Engine startup complete", {
            indexed: this.totalIndexedRecords(),
            relationships: this.relationshipIndex.getGraph().edgeCount,
        });
    }
    onRecordStored(record) {
        this.indexRecord(record);
    }
    onRecordUpdated(record) {
        this.indexRecord(record);
        this.foundation?.getRetrievalEngine().invalidateCache(record.memoryId);
    }
    onRecordRemoved(memoryId) {
        this.indexBuilder.removeFromIndexes(memoryId);
        this.foundation?.getRetrievalEngine().invalidateCache(memoryId);
        this.writeManifest();
    }
    indexRecord(record) {
        this.ensureReady();
        const allIds = this.storageEngine.getIndexEntries().map((e) => e.memoryId);
        if (!allIds.includes(record.memoryId)) {
            allIds.push(record.memoryId);
        }
        const ms = this.indexBuilder.indexRecord(record, allIds);
        this.indexTimes.push(ms);
        this.totalIndexed++;
        this.writeManifest();
        return ms;
    }
    lookup(query) {
        this.ensureReady();
        const start = Date.now();
        const { memoryIds, indexTypesUsed } = this.indexLookup.lookup(query);
        const lookupMs = Date.now() - start;
        this.lookupTimes.push(lookupMs);
        return {
            memoryIds,
            indexTypesUsed,
            lookupMs,
            fromOptimizedIndex: true,
        };
    }
    getRelated(memoryId) {
        return this.relationshipIndex.getRelated(memoryId);
    }
    async runHealthCheck() {
        this.ensureReady();
        const recordIds = this.storageEngine.getIndexEntries().map((e) => e.memoryId);
        this.lastHealth = this.healthChecker.runCheck(recordIds);
        if (!this.lastHealth.healthy && this.lastHealth.missingIndexes.length > 0) {
            await this.rebuildIndexes();
            this.lastHealth = this.healthChecker.runCheck(recordIds);
            this.lastHealth.repaired = this.lastHealth.missingIndexes.length;
        }
        return this.lastHealth;
    }
    async rebuildIndexes() {
        this.ensureReady();
        return this.rebuilder.rebuild(this.storageEngine);
    }
    optimizeIndexes() {
        this.optimizer.optimize();
        this.writeManifest();
    }
    totalIndexedRecords() {
        return this.invertedStore.getIndex(IndexType.MemoryId).entries
            ? Object.values(this.invertedStore.getIndex(IndexType.MemoryId).entries).flat().length
            : 0;
    }
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const knownIssues = this.lastHealth?.issues ?? [];
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (this.lastHealth && !this.lastHealth.healthy)
            readinessScore -= 20;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            indexPerformance: {
                averageIndexMs: avg(this.indexTimes),
                averageLookupMs: avg(this.lookupTimes),
                lastIndexMs: this.indexTimes[this.indexTimes.length - 1] ?? 0,
                lastLookupMs: this.lookupTimes[this.lookupTimes.length - 1] ?? 0,
                totalIndexes: Object.values(IndexType).length,
            },
            indexIntegrity: this.lastHealth?.integrityValid ? "verified" : "issues detected",
            relationshipStatus: `${this.relationshipIndex.getGraph().edgeCount} relationship edges`,
            optimizationStatus: "automatic optimization active",
            totalIndexedRecords: this.totalIndexedRecords(),
            relationshipCount: this.relationshipIndex.getGraph().edgeCount,
            knownIssues,
            readinessScore: Math.max(0, readinessScore),
            timestamp: new Date().toISOString(),
        };
    }
    writeManifest() {
        const manifest = {
            version: "0.1.0",
            lastUpdated: new Date().toISOString(),
            totalRecords: this.totalIndexedRecords(),
            indexTypes: Object.values(IndexType),
            relationshipCount: this.relationshipIndex.getGraph().edgeCount,
            checksum: crypto
                .createHash("sha256")
                .update(String(this.totalIndexedRecords()))
                .digest("hex")
                .slice(0, 16),
        };
        const manifestPath = path.join(this.invertedStore.getIndexesDir(), "master-manifest.json");
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    }
    ensureReady() {
        if (!this.initialized || !this.storageEngine) {
            throw new MemoryIndexEngineError("Memory Index Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=memory-index-engine.js.map
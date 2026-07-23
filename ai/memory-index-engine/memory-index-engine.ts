import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { MemoryRecord } from "../memory-storage-engine/types.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import type { AiMemoryStorageEngine } from "../memory-storage-engine/memory-storage-engine.js";
import { InvertedIndexStore } from "./inverted-index-store.js";
import { RelationshipIndex } from "./relationship-index.js";
import { IndexBuilder } from "./index-builder.js";
import { IndexLookup } from "./index-lookup.js";
import { IndexHealthChecker } from "./index-health-checker.js";
import { IndexRebuilder } from "./index-rebuilder.js";
import { IndexOptimizer } from "./index-optimizer.js";
import { MemoryIndexLogger } from "./index-logger.js";
import {
  IndexHealthReport,
  IndexLookupQuery,
  IndexLookupResult,
  IndexRebuildResult,
  IndexType,
  MasterIndexManifest,
  MemoryIndexEngineError,
  MemoryIndexStatusReport,
} from "./types.js";

/**
 * Memory Index Engine — organizes stored memory into intelligent indexes for fast retrieval.
 */
export class AiMemoryIndexEngine {
  private foundation: AiMemoryFoundation | null = null;
  private storageEngine: AiMemoryStorageEngine | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;
  private lastHealth: IndexHealthReport | null = null;

  readonly logger = new MemoryIndexLogger();
  private readonly invertedStore = new InvertedIndexStore(this.logger);
  private readonly relationshipIndex = new RelationshipIndex(this.logger);
  private indexBuilder: IndexBuilder | null = null;
  private indexLookup: IndexLookup | null = null;
  private healthChecker: IndexHealthChecker | null = null;
  private rebuilder: IndexRebuilder | null = null;
  private optimizer: IndexOptimizer | null = null;

  private indexTimes: number[] = [];
  private lookupTimes: number[] = [];
  private totalIndexed = 0;

  initialize(foundation: AiMemoryFoundation, storageRoot: string): void {
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
    this.rebuilder = new IndexRebuilder(
      this.invertedStore,
      this.relationshipIndex,
      this.indexBuilder,
      this.logger
    );
    this.optimizer = new IndexOptimizer(this.invertedStore, this.logger);

    this.initialized = true;
    this.logger.log("info", "startup", "Memory Index Engine initialized", { indexesDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    const recordIds = this.storageEngine!.getIndexEntries().map((e) => e.memoryId);
    this.lastHealth = this.healthChecker!.runCheck(recordIds);

    if (!this.lastHealth.healthy || recordIds.length > 0) {
      const idIndex = this.invertedStore.getIndex(IndexType.MemoryId);
      if (idIndex.entryCount < recordIds.length) {
        await this.rebuildIndexes();
      }
    }

    this.optimizer!.optimize();
    this.writeManifest();
    this.startupComplete = true;

    this.logger.log("info", "startup", "Memory Index Engine startup complete", {
      indexed: this.totalIndexedRecords(),
      relationships: this.relationshipIndex.getGraph().edgeCount,
    });
  }

  onRecordStored(record: MemoryRecord): void {
    this.indexRecord(record);
  }

  onRecordUpdated(record: MemoryRecord): void {
    this.indexRecord(record);
    this.foundation?.getRetrievalEngine().invalidateCache(record.memoryId);
  }

  onRecordRemoved(memoryId: string): void {
    this.indexBuilder!.removeFromIndexes(memoryId);
    this.foundation?.getRetrievalEngine().invalidateCache(memoryId);
    this.writeManifest();
  }

  indexRecord(record: MemoryRecord): number {
    this.ensureReady();
    const allIds = this.storageEngine!.getIndexEntries().map((e) => e.memoryId);
    if (!allIds.includes(record.memoryId)) {
      allIds.push(record.memoryId);
    }
    const ms = this.indexBuilder!.indexRecord(record, allIds);
    this.indexTimes.push(ms);
    this.totalIndexed++;
    this.writeManifest();
    return ms;
  }

  lookup(query: IndexLookupQuery): IndexLookupResult {
    this.ensureReady();
    const start = Date.now();
    const { memoryIds, indexTypesUsed } = this.indexLookup!.lookup(query);
    const lookupMs = Date.now() - start;
    this.lookupTimes.push(lookupMs);

    return {
      memoryIds,
      indexTypesUsed,
      lookupMs,
      fromOptimizedIndex: true,
    };
  }

  getRelated(memoryId: string): string[] {
    return this.relationshipIndex.getRelated(memoryId);
  }

  async runHealthCheck(): Promise<IndexHealthReport> {
    this.ensureReady();
    const recordIds = this.storageEngine!.getIndexEntries().map((e) => e.memoryId);
    this.lastHealth = this.healthChecker!.runCheck(recordIds);

    if (!this.lastHealth.healthy && this.lastHealth.missingIndexes.length > 0) {
      await this.rebuildIndexes();
      this.lastHealth = this.healthChecker!.runCheck(recordIds);
      this.lastHealth.repaired = this.lastHealth.missingIndexes.length;
    }

    return this.lastHealth;
  }

  async rebuildIndexes(): Promise<IndexRebuildResult> {
    this.ensureReady();
    return this.rebuilder!.rebuild(this.storageEngine!);
  }

  optimizeIndexes(): void {
    this.optimizer!.optimize();
    this.writeManifest();
  }

  totalIndexedRecords(): number {
    return this.invertedStore.getIndex(IndexType.MemoryId).entries
      ? Object.values(this.invertedStore.getIndex(IndexType.MemoryId).entries).flat().length
      : 0;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  buildStatusReport(): MemoryIndexStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const knownIssues = this.lastHealth?.issues ?? [];
    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (this.lastHealth && !this.lastHealth.healthy) readinessScore -= 20;

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

  private writeManifest(): void {
    const manifest: MasterIndexManifest = {
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

  private ensureReady(): void {
    if (!this.initialized || !this.storageEngine) {
      throw new MemoryIndexEngineError("Memory Index Engine not initialized", "NOT_INITIALIZED");
    }
  }
}

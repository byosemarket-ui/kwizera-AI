import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
import type { KnowledgeStorageIndexEntry } from "../knowledge-storage-engine/types.js";
import { KnowledgeRetrievalLogger } from "./retrieval-logger.js";

interface CacheEntry {
  record: KnowledgeRecord;
  indexVersion: number;
  lastUpdated: string;
  cachedAt: number;
}

const MAX_CACHE_SIZE = 100;

export class KnowledgeRetrievalCache {
  private cache = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  constructor(private readonly logger: KnowledgeRetrievalLogger) {}

  get(knowledgeId: string, indexEntry?: KnowledgeStorageIndexEntry): KnowledgeRecord | null {
    const entry = this.cache.get(knowledgeId);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (
      indexEntry &&
      (indexEntry.version !== entry.indexVersion || indexEntry.lastUpdated !== entry.lastUpdated)
    ) {
      this.cache.delete(knowledgeId);
      this.misses++;
      this.logger.log("debug", "cache", "Cache entry invalidated", { knowledgeId });
      return null;
    }

    this.hits++;
    return entry.record;
  }

  set(knowledgeId: string, record: KnowledgeRecord, indexEntry?: KnowledgeStorageIndexEntry): void {
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }

    this.cache.set(knowledgeId, {
      record,
      indexVersion: indexEntry?.version ?? record.version,
      lastUpdated: indexEntry?.lastUpdated ?? record.lastUpdated,
      cachedAt: Date.now(),
    });
  }

  invalidate(knowledgeId: string): void {
    this.cache.delete(knowledgeId);
  }

  clear(): void {
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

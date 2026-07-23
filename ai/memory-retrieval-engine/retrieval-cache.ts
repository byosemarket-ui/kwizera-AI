import type { MemoryRecord } from "../memory-storage-engine/types.js";
import type { MemoryStorageIndexEntry } from "../memory-storage-engine/types.js";
import { MemoryRetrievalLogger } from "./retrieval-logger.js";

interface CacheEntry {
  record: MemoryRecord;
  indexVersion: number;
  lastUpdate: string;
  cachedAt: number;
}

const MAX_CACHE_SIZE = 100;

export class RetrievalCache {
  private cache = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  constructor(private readonly logger: MemoryRetrievalLogger) {}

  get(memoryId: string, indexEntry?: MemoryStorageIndexEntry): MemoryRecord | null {
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

  set(memoryId: string, record: MemoryRecord, indexEntry?: MemoryStorageIndexEntry): void {
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }

    this.cache.set(memoryId, {
      record,
      indexVersion: indexEntry?.version ?? record.version,
      lastUpdate: indexEntry?.lastUpdate ?? record.lastUpdate,
      cachedAt: Date.now(),
    });
  }

  invalidate(memoryId: string): void {
    this.cache.delete(memoryId);
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

import type { CacheCategory, CacheEntryMeta, CacheStats } from "./types";

const STORAGE_KEY = "kwizera.workspace-cache.v1";

interface CacheRecord {
  meta: CacheEntryMeta;
  value: unknown;
}

const emptyCategory = (): Record<CacheCategory, { entries: number; bytes: number }> => ({
  images: { entries: 0, bytes: 0 },
  "product-analysis": { entries: 0, bytes: 0 },
  storyboards: { entries: 0, bytes: 0 },
  "ai-results": { entries: 0, bytes: 0 },
  previews: { entries: 0, bytes: 0 },
  "layout-data": { entries: 0, bytes: 0 },
});

export class SmartCacheManager {
  private entries = new Map<string, CacheRecord>();
  private lastCleanupAt: string | null = null;

  constructor(private maxBytes = 32 * 1024 * 1024) {
    this.hydrate();
  }

  setMaxBytes(maxBytes: number): void {
    this.maxBytes = Math.max(4 * 1024 * 1024, maxBytes);
  }

  get<T>(key: string): T | null {
    const record = this.entries.get(key);
    if (!record) return null;
    record.meta.lastAccessAt = new Date().toISOString();
    record.meta.hits += 1;
    return record.value as T;
  }

  set(key: string, category: CacheCategory, value: unknown, sizeBytes?: number): void {
    const size = sizeBytes ?? estimateSize(value);
    const now = new Date().toISOString();
    const existing = this.entries.get(key);
    this.entries.set(key, {
      value,
      meta: {
        key,
        category,
        sizeBytes: size,
        createdAt: existing?.meta.createdAt ?? now,
        lastAccessAt: now,
        hits: existing?.meta.hits ?? 0,
      },
    });
    this.enforceBudget();
    this.persistLight();
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  delete(key: string): boolean {
    const ok = this.entries.delete(key);
    if (ok) this.persistLight();
    return ok;
  }

  stats(): CacheStats {
    const byCategory = emptyCategory();
    let totalBytes = 0;
    for (const { meta } of this.entries.values()) {
      totalBytes += meta.sizeBytes;
      byCategory[meta.category].entries += 1;
      byCategory[meta.category].bytes += meta.sizeBytes;
    }
    return {
      entries: this.entries.size,
      totalBytes,
      byCategory,
      lastCleanupAt: this.lastCleanupAt,
    };
  }

  /** Remove expired / least-used entries. Never touches production-critical keys when protected. */
  cleanup(ttlMs: number, protectKeys: Set<string> = new Set()): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, record] of [...this.entries.entries()]) {
      if (protectKeys.has(key)) continue;
      const age = now - new Date(record.meta.lastAccessAt).getTime();
      if (age > ttlMs || record.meta.hits === 0 && age > ttlMs / 2) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    this.enforceBudget();
    this.lastCleanupAt = new Date().toISOString();
    this.persistLight();
    return removed;
  }

  clearCategory(category: CacheCategory, protectKeys: Set<string> = new Set()): number {
    let removed = 0;
    for (const [key, record] of [...this.entries.entries()]) {
      if (record.meta.category !== category || protectKeys.has(key)) continue;
      this.entries.delete(key);
      removed += 1;
    }
    this.persistLight();
    return removed;
  }

  private enforceBudget(): void {
    let total = [...this.entries.values()].reduce((sum, r) => sum + r.meta.sizeBytes, 0);
    if (total <= this.maxBytes) return;
    const ranked = [...this.entries.entries()].sort((a, b) => {
      const scoreA = a[1].meta.hits * 10 - (Date.now() - new Date(a[1].meta.lastAccessAt).getTime()) / 60_000;
      const scoreB = b[1].meta.hits * 10 - (Date.now() - new Date(b[1].meta.lastAccessAt).getTime()) / 60_000;
      return scoreA - scoreB;
    });
    for (const [key, record] of ranked) {
      if (total <= this.maxBytes * 0.85) break;
      this.entries.delete(key);
      total -= record.meta.sizeBytes;
    }
  }

  private hydrate(): void {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as {
        metas?: CacheEntryMeta[];
      } | null;
      // Only restore metadata index — values stay ephemeral for memory safety
      if (raw?.metas) {
        for (const meta of raw.metas.slice(0, 40)) {
          this.entries.set(meta.key, { meta, value: null });
        }
      }
    } catch {
      /* ignore */
    }
  }

  private persistLight(): void {
    try {
      const metas = [...this.entries.values()].map((r) => r.meta).slice(0, 40);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), metas }));
    } catch {
      /* quota — drop oldest */
      this.cleanup(0);
    }
  }
}

function estimateSize(value: unknown): number {
  try {
    return Math.max(64, JSON.stringify(value)?.length ?? 64);
  } catch {
    return 256;
  }
}

export const smartCacheManager = new SmartCacheManager();

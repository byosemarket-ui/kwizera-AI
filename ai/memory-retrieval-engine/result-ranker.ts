import { MemoryStorageIndexEntry } from "../memory-storage-engine/types.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { MemorySearchQuery, RankedMemoryResult, RankingFactors, SearchMode } from "./types.js";
import { UsageTracker } from "./usage-tracker.js";

export class ResultRanker {
  constructor(private readonly usageTracker: UsageTracker) {}

  rank(
    entries: MemoryStorageIndexEntry[],
    query: MemorySearchQuery,
    relatedToId?: string
  ): RankedMemoryResult[] {
    const mode = query.mode ?? SearchMode.Hybrid;
    const ranked = entries.map((entry) => {
      const usage = this.usageTracker.getStat(entry.memoryId);
      const factors = this.computeFactors(entry, query, usage, relatedToId, mode);
      return {
        memoryId: entry.memoryId,
        memoryType: entry.memoryType,
        title: entry.title,
        category: entry.category,
        ranking: factors,
        rank: 0,
      };
    });

    ranked.sort((a, b) => b.ranking.compositeScore - a.ranking.compositeScore);

    const limit = query.limit ?? 20;
    return ranked.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
  }

  private computeFactors(
    entry: MemoryStorageIndexEntry,
    query: MemorySearchQuery,
    usage: { accessCount: number; lastAccessTime: string },
    relatedToId: string | undefined,
    mode: SearchMode
  ): RankingFactors {
    const relevanceScore = this.computeRelevance(entry, query);
    const qualityScore = this.estimateQuality(entry);
    const usageFrequency = Math.min(usage.accessCount, 100);
    const lastAccessTime = usage.lastAccessTime;
    const learningImportance = this.computeLearningImportance(entry);
    const relationshipStrength = relatedToId
      ? this.computeRelationshipStrength(entry, relatedToId)
      : mode === SearchMode.Relationship
        ? 50
        : 0;

    const recencyBonus = this.computeRecencyBonus(entry.lastUpdate, usage.lastAccessTime);
    const priorityBonus = mode === SearchMode.Priority ? qualityScore * 0.1 : 0;

    const compositeScore = Math.round(
      relevanceScore * 0.3 +
        qualityScore * 0.25 +
        Math.min(usageFrequency, 25) +
        recencyBonus * 0.15 +
        learningImportance * 0.1 +
        relationshipStrength * 0.1 +
        priorityBonus
    );

    return {
      relevanceScore,
      qualityScore,
      usageFrequency,
      lastAccessTime,
      learningImportance,
      relationshipStrength,
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
    };
  }

  private computeRelevance(entry: MemoryStorageIndexEntry, query: MemorySearchQuery): number {
    let score = 50;

    if (query.text) {
      const text = query.text.toLowerCase();
      if (entry.title.toLowerCase().includes(text)) score += 25;
      if (entry.searchableText.includes(text)) score += 15;
    }

    if (query.tags?.length) {
      const matches = query.tags.filter((t) => entry.searchableText.includes(t.toLowerCase())).length;
      score += matches * 10;
    }

    if (query.keywords?.length) {
      const matches = query.keywords.filter((k) => entry.searchableText.includes(k.toLowerCase())).length;
      score += matches * 8;
    }

    if (query.category && entry.category.toLowerCase().includes(query.category.toLowerCase())) {
      score += 15;
    }

    return Math.min(100, score);
  }

  private estimateQuality(entry: MemoryStorageIndexEntry): number {
    let score = 70;
    if (entry.title.length > 10) score += 10;
    if (entry.searchableText.length > 50) score += 10;
    if (entry.version > 1) score += 5;
    return Math.min(100, score);
  }

  private computeLearningImportance(entry: MemoryStorageIndexEntry): number {
    if (entry.memoryType === MemoryStorageType.Learning) return 90;
    if (entry.memoryType === MemoryStorageType.Reasoning) return 75;
    if (entry.memoryType === MemoryStorageType.Decision) return 70;
    return 40;
  }

  private computeRelationshipStrength(entry: MemoryStorageIndexEntry, relatedToId: string): number {
    if (entry.memoryId === relatedToId) return 0;
    if (entry.searchableText.includes(relatedToId.toLowerCase())) return 80;
    return 30;
  }

  private computeRecencyBonus(lastUpdate: string, lastAccess: string): number {
    const updateAge = Date.now() - new Date(lastUpdate).getTime();
    const accessAge = Date.now() - new Date(lastAccess).getTime();
    const day = 86400000;

    let bonus = 0;
    if (updateAge < day) bonus += 40;
    else if (updateAge < day * 7) bonus += 25;
    else if (updateAge < day * 30) bonus += 10;

    if (accessAge < day) bonus += 20;
    return Math.min(60, bonus);
  }
}

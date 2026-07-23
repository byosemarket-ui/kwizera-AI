/**
 * KWIZERA AI STUDIO — Memory Retrieval Engine types (Step 3C)
 */

import type { MemoryRecord, MemoryStorageType } from "../memory-storage-engine/types.js";

export enum SearchMode {
  Exact = "exact",
  Keyword = "keyword",
  Category = "category",
  Relationship = "relationship",
  Recent = "recent",
  Priority = "priority",
  History = "history",
  Hybrid = "hybrid",
}

export enum SearchField {
  MemoryId = "memory-id",
  Project = "project",
  Product = "product",
  Video = "video",
  Marketing = "marketing",
  Category = "category",
  Tags = "tags",
  Keywords = "keywords",
  Date = "date",
  Workflow = "workflow",
  Decision = "decision",
  Reasoning = "reasoning",
  Language = "language",
  UserPreference = "user-preference",
  Related = "related",
}

export interface MemorySearchQuery {
  mode?: SearchMode;
  memoryId?: string;
  memoryType?: MemoryStorageType;
  project?: string;
  product?: string;
  video?: string;
  marketing?: string;
  category?: string;
  tags?: string[];
  keywords?: string[];
  text?: string;
  dateFrom?: string;
  dateTo?: string;
  workflow?: string;
  decision?: string;
  reasoning?: string;
  language?: string;
  userPreference?: string;
  relatedTo?: string;
  limit?: number;
  requesterId?: string;
}

export interface RankingFactors {
  relevanceScore: number;
  qualityScore: number;
  usageFrequency: number;
  lastAccessTime: string;
  learningImportance: number;
  relationshipStrength: number;
  compositeScore: number;
}

export interface RankedMemoryResult {
  memoryId: string;
  memoryType: MemoryStorageType;
  title: string;
  category: string;
  record?: MemoryRecord;
  ranking: RankingFactors;
  rank: number;
}

export interface MemorySearchResponse {
  success: boolean;
  mode: SearchMode;
  results: RankedMemoryResult[];
  relatedMemories: RankedMemoryResult[];
  recommendations: RankedMemoryResult[];
  searchMs: number;
  retrievalMs: number;
  totalCandidates: number;
  fromCache: boolean;
  diagnostics: string[];
}

export interface MemoryRetrievalResponse {
  success: boolean;
  memoryId: string;
  record?: MemoryRecord;
  relatedMemories: RankedMemoryResult[];
  recommendations: RankedMemoryResult[];
  retrievalMs: number;
  fromCache: boolean;
  diagnostics: string[];
  recoverySuggestion?: string;
}

export interface UsageStat {
  memoryId: string;
  accessCount: number;
  lastAccessTime: string;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export interface MemoryRetrievalStatusReport {
  engineStatus: string;
  searchPerformance: {
    averageSearchMs: number;
    averageRetrievalMs: number;
    lastSearchMs: number;
    lastRetrievalMs: number;
  };
  rankingQuality: string;
  cacheStatus: CacheStats;
  validationStatus: string;
  totalSearches: number;
  totalRetrievals: number;
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class MemoryRetrievalEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "MemoryRetrievalEngineError";
  }
}

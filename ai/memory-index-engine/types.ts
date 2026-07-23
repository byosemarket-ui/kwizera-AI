/**
 * KWIZERA AI STUDIO — Memory Index Engine types (Step 3D)
 */

import type { MemoryRecord, MemoryStorageType } from "../memory-storage-engine/types.js";

export enum IndexType {
  MemoryId = "memory-id",
  Project = "project",
  Product = "product",
  Video = "video",
  Marketing = "marketing",
  Category = "category",
  Brand = "brand",
  Tags = "tags",
  Keywords = "keywords",
  Language = "language",
  Workflow = "workflow",
  Decision = "decision",
  Reasoning = "reasoning",
  Date = "date",
  FileType = "file-type",
  AiModule = "ai-module",
  UserPreferences = "user-preferences",
  Related = "related",
}

export enum IndexSearchMode {
  Exact = "exact",
  Keyword = "keyword",
  Category = "category",
  Relationship = "relationship",
  Recent = "recent",
  Hybrid = "hybrid",
  Priority = "priority",
  Similarity = "similarity",
}

export interface InvertedIndexData {
  version: string;
  indexType: IndexType;
  lastUpdated: string;
  entries: Record<string, string[]>;
  entryCount: number;
}

export interface MemoryRelationshipNode {
  memoryId: string;
  memoryType: MemoryStorageType;
  relatedIds: string[];
  projects: string[];
  products: string[];
  videos: string[];
  marketing: string[];
  learning: string[];
  knowledge: string[];
  workflows: string[];
  decisions: string[];
  reasoning: string[];
  strength: number;
}

export interface RelationshipGraph {
  version: string;
  lastUpdated: string;
  nodes: Record<string, MemoryRelationshipNode>;
  edgeCount: number;
}

export interface MasterIndexManifest {
  version: string;
  lastUpdated: string;
  totalRecords: number;
  indexTypes: IndexType[];
  relationshipCount: number;
  checksum: string;
}

export interface IndexLookupQuery {
  mode?: IndexSearchMode;
  memoryId?: string;
  project?: string;
  product?: string;
  video?: string;
  marketing?: string;
  category?: string;
  brand?: string;
  tags?: string[];
  keywords?: string[];
  language?: string;
  workflow?: string;
  decision?: string;
  reasoning?: string;
  dateFrom?: string;
  dateTo?: string;
  fileType?: string;
  aiModule?: string;
  userPreference?: string;
  relatedTo?: string;
  text?: string;
  limit?: number;
}

export interface IndexLookupResult {
  memoryIds: string[];
  indexTypesUsed: IndexType[];
  lookupMs: number;
  fromOptimizedIndex: boolean;
}

export interface IndexHealthReport {
  healthy: boolean;
  integrityValid: boolean;
  consistencyValid: boolean;
  missingIndexes: string[];
  duplicateEntries: number;
  brokenRelationships: number;
  issues: string[];
  repaired: number;
  timestamp: string;
}

export interface IndexRebuildResult {
  success: boolean;
  recordsIndexed: number;
  relationshipsBuilt: number;
  durationMs: number;
  dataProtected: boolean;
}

export interface MemoryIndexStatusReport {
  engineStatus: string;
  indexPerformance: {
    averageIndexMs: number;
    averageLookupMs: number;
    lastIndexMs: number;
    lastLookupMs: number;
    totalIndexes: number;
  };
  indexIntegrity: string;
  relationshipStatus: string;
  optimizationStatus: string;
  totalIndexedRecords: number;
  relationshipCount: number;
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class MemoryIndexEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "MemoryIndexEngineError";
  }
}

export type { MemoryRecord };

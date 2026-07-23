/**
 * KWIZERA AI STUDIO — Relationship Memory Engine types (Step 3J)
 */

import { MemoryStorageType } from "../memory-storage-engine/types.js";

export enum RelationshipType {
  ParentChild = "parent-child",
  Related = "related",
  Similar = "similar",
  Reference = "reference",
  Dependency = "dependency",
  Sequence = "sequence",
  Version = "version",
  Alternative = "alternative",
  DerivedFrom = "derived-from",
  InspiredBy = "inspired-by",
  RecommendedWith = "recommended-with",
  FrequentlyUsedTogether = "frequently-used-together",
}

export enum ValidationStatus {
  Valid = "valid",
  Pending = "pending",
  Invalid = "invalid",
  Repaired = "repaired",
}

export interface RelationshipEdge {
  relationshipId: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  strengthScore: number;
  confidenceScore: number;
  creationTime: string;
  lastUpdated: string;
  source: string;
  reason: string;
  validationStatus: ValidationStatus;
}

export interface RelationshipNode {
  memoryId: string;
  memoryType: MemoryStorageType;
  edgeIds: string[];
}

export interface RelationshipGraphData {
  version: string;
  lastUpdated: string;
  nodes: Record<string, RelationshipNode>;
  edges: Record<string, RelationshipEdge>;
  edgeCount: number;
}

export interface RelationshipDiscoveryResult {
  discovered: number;
  updated: number;
  durationMs: number;
}

export interface RelationshipRecommendation {
  memoryId: string;
  memoryType: MemoryStorageType;
  relationshipType: RelationshipType;
  strengthScore: number;
  reason: string;
}

export interface RelationshipRecommendations {
  memoryId: string;
  projects: RelationshipRecommendation[];
  videos: RelationshipRecommendation[];
  products: RelationshipRecommendation[];
  campaigns: RelationshipRecommendation[];
  workflows: RelationshipRecommendation[];
  learning: RelationshipRecommendation[];
  decisions: RelationshipRecommendation[];
  knowledge: RelationshipRecommendation[];
  all: RelationshipRecommendation[];
}

export interface IntegrityDiagnostic {
  issue: string;
  severity: "warning" | "error";
  repaired: boolean;
  detail: string;
}

export interface IntegrityReport {
  valid: boolean;
  issuesFound: number;
  issuesRepaired: number;
  diagnostics: IntegrityDiagnostic[];
  durationMs: number;
}

export interface RelationshipMemoryStatusReport {
  engineStatus: string;
  relationshipGraphStatus: string;
  recommendationQuality: string;
  integrityStatus: string;
  totalNodes: number;
  totalEdges: number;
  performance: {
    averageDiscoveryMs: number;
    averageTraversalMs: number;
    averageRecommendationMs: number;
    lastIntegrityCheckMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class RelationshipMemoryEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "RelationshipMemoryEngineError";
  }
}

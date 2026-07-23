/**
 * KWIZERA AI STUDIO — Knowledge Graph Engine types (Step 4D)
 */
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
export declare enum KnowledgeNodeType {
    Product = "product",
    Image = "image",
    Video = "video",
    MarketingCampaign = "marketing-campaign",
    Brand = "brand",
    Language = "language",
    CreativeStyle = "creative-style",
    Workflow = "workflow",
    Project = "project",
    Decision = "decision",
    Reasoning = "reasoning",
    Learning = "learning",
    MemoryObject = "memory-object",
    BusinessConcept = "business-concept",
    UserPreference = "user-preference",
    Technical = "technical",
    Industry = "industry"
}
export declare enum KnowledgeRelationType {
    BelongsTo = "belongs-to",
    PartOf = "part-of",
    Uses = "uses",
    Produces = "produces",
    DependsOn = "depends-on",
    SimilarTo = "similar-to",
    RelatedTo = "related-to",
    DerivedFrom = "derived-from",
    InspiredBy = "inspired-by",
    Improves = "improves",
    Requires = "requires",
    RecommendedWith = "recommended-with",
    FrequentlyUsedTogether = "frequently-used-together",
    Parent = "parent",
    Child = "child"
}
export declare enum GraphValidationStatus {
    Valid = "valid",
    Pending = "pending",
    Invalid = "invalid",
    Repaired = "repaired"
}
export interface KnowledgeGraphNode {
    nodeId: string;
    nodeType: KnowledgeNodeType;
    knowledgeType?: KnowledgeStorageType;
    title: string;
    edgeIds: string[];
    searchableText: string;
    lastUpdated: string;
}
export interface KnowledgeGraphEdge {
    relationshipId: string;
    sourceId: string;
    targetId: string;
    relationshipType: KnowledgeRelationType;
    strengthScore: number;
    confidenceScore: number;
    evidence: string;
    source: string;
    creationTime: string;
    lastUpdated: string;
    validationStatus: GraphValidationStatus;
}
export interface KnowledgeGraphData {
    version: string;
    lastUpdated: string;
    nodes: Record<string, KnowledgeGraphNode>;
    edges: Record<string, KnowledgeGraphEdge>;
    edgeCount: number;
}
export interface KnowledgeGraphDiscoveryResult {
    discovered: number;
    updated: number;
    nodesCreated: number;
    durationMs: number;
}
export interface KnowledgeGraphRecommendation {
    nodeId: string;
    nodeType: KnowledgeNodeType;
    relationshipType: KnowledgeRelationType;
    strengthScore: number;
    reason: string;
}
export interface KnowledgeGraphRecommendations {
    sourceId: string;
    products: KnowledgeGraphRecommendation[];
    videos: KnowledgeGraphRecommendation[];
    marketing: KnowledgeGraphRecommendation[];
    brands: KnowledgeGraphRecommendation[];
    workflows: KnowledgeGraphRecommendation[];
    decisions: KnowledgeGraphRecommendation[];
    learning: KnowledgeGraphRecommendation[];
    memory: KnowledgeGraphRecommendation[];
    all: KnowledgeGraphRecommendation[];
}
export interface GraphIntegrityDiagnostic {
    issue: string;
    severity: "warning" | "error";
    repaired: boolean;
    detail: string;
}
export interface GraphIntegrityReport {
    valid: boolean;
    issuesFound: number;
    issuesRepaired: number;
    diagnostics: GraphIntegrityDiagnostic[];
    durationMs: number;
}
export interface GraphSearchQuery {
    nodeId?: string;
    nodeType?: KnowledgeNodeType;
    relationshipType?: KnowledgeRelationType;
    text?: string;
    minStrength?: number;
    limit?: number;
}
export interface GraphPathResult {
    found: boolean;
    path: string[];
    edges: KnowledgeGraphEdge[];
    distance: number;
    durationMs: number;
}
export interface KnowledgeGraphStatusReport {
    engineStatus: string;
    graphStatus: string;
    nodeCount: number;
    relationshipCount: number;
    graphIntegrity: string;
    recommendationQuality: string;
    performance: {
        averageDiscoveryMs: number;
        averageTraversalMs: number;
        averageSearchMs: number;
        averageRecommendationMs: number;
        lastIntegrityCheckMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class KnowledgeGraphEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare function mapStorageTypeToNodeType(type: KnowledgeStorageType): KnowledgeNodeType;
//# sourceMappingURL=types.d.ts.map
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeGraphStore } from "./knowledge-graph-store.js";
import { KnowledgeGraphSearcher } from "./knowledge-graph-traverser.js";
import { KnowledgeGraphLogger } from "./graph-logger.js";
import { GraphIntegrityReport, GraphPathResult, KnowledgeGraphData, KnowledgeGraphDiscoveryResult, KnowledgeGraphEdge, KnowledgeGraphNode, KnowledgeGraphRecommendations, KnowledgeGraphStatusReport, KnowledgeNodeType, KnowledgeRelationType } from "./types.js";
export interface CreateKnowledgeRelationshipInput {
    sourceId: string;
    targetId: string;
    relationshipType: KnowledgeRelationType;
    evidence: string;
    strengthScore?: number;
    confidenceScore?: number;
}
/**
 * Knowledge Graph Engine — central intelligence network for knowledge relationships.
 */
export declare class AiKnowledgeGraphEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: KnowledgeGraphLogger;
    readonly graph: KnowledgeGraphStore;
    private discovery;
    private integrity;
    private recommender;
    private traverser;
    private searcher;
    private discoveryTimes;
    private traversalTimes;
    private searchTimes;
    private recommendationTimes;
    private lastIntegrityMs;
    initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    evolveGraph(knowledgeId: string): Promise<KnowledgeGraphDiscoveryResult>;
    removeKnowledgeFromGraph(knowledgeId: string): Promise<void>;
    discoverRelationships(knowledgeId?: string): Promise<KnowledgeGraphDiscoveryResult>;
    createRelationship(input: CreateKnowledgeRelationshipInput): KnowledgeGraphEdge | null;
    createNode(nodeId: string, nodeType: KnowledgeNodeType, title: string, searchableText: string): KnowledgeGraphNode;
    updateRelationship(relationshipId: string, updates: Partial<Pick<KnowledgeGraphEdge, "strengthScore" | "confidenceScore" | "evidence" | "validationStatus">>): boolean;
    removeRelationship(relationshipId: string): boolean;
    getRelationships(nodeId: string): KnowledgeGraphEdge[];
    getRecommendations(nodeId: string, limit?: number): KnowledgeGraphRecommendations;
    traverse(nodeId: string, maxDepth?: number): string[];
    neighborhood(nodeId: string, depth?: number): string[];
    shortestPath(sourceId: string, targetId: string): GraphPathResult;
    findPath(sourceId: string, targetId: string, maxDepth?: number): GraphPathResult;
    searchNodes(query: Parameters<KnowledgeGraphSearcher["searchNodes"]>[0]): KnowledgeGraphNode[];
    searchRelationships(query: Parameters<KnowledgeGraphSearcher["searchRelationships"]>[0]): KnowledgeGraphEdge[];
    similaritySearch(nodeId: string, limit?: number): KnowledgeGraphNode[];
    validateIntegrity(): GraphIntegrityReport;
    optimizeGraph(): {
        nodesRemoved: number;
        edgesRemoved: number;
    };
    getGraph(): KnowledgeGraphData;
    buildStatusReport(): KnowledgeGraphStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private validateRelationshipInput;
    private ensureReady;
}
//# sourceMappingURL=knowledge-graph-engine.d.ts.map
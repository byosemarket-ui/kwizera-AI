import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { RelationshipGraphStore } from "./relationship-graph-store.js";
import { RelationshipMemoryLogger } from "./relationship-logger.js";
import { IntegrityReport, RelationshipDiscoveryResult, RelationshipEdge, RelationshipGraphData, RelationshipMemoryStatusReport, RelationshipRecommendations, RelationshipType } from "./types.js";
export interface CreateRelationshipInput {
    sourceId: string;
    targetId: string;
    sourceType: MemoryStorageType;
    targetType: MemoryStorageType;
    relationshipType: RelationshipType;
    reason: string;
    strengthScore?: number;
    confidenceScore?: number;
}
/**
 * Relationship Memory Engine — central graph for intelligent memory connections.
 */
export declare class AiRelationshipMemoryEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: RelationshipMemoryLogger;
    readonly graph: RelationshipGraphStore;
    private discovery;
    private integrity;
    private recommender;
    private discoveryTimes;
    private traversalTimes;
    private recommendationTimes;
    private lastIntegrityMs;
    initialize(foundation: AiMemoryFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    discoverRelationships(memoryId?: string): Promise<RelationshipDiscoveryResult>;
    createRelationship(input: CreateRelationshipInput): RelationshipEdge | null;
    updateRelationship(relationshipId: string, updates: Partial<Pick<RelationshipEdge, "strengthScore" | "confidenceScore" | "reason" | "validationStatus">>): boolean;
    removeRelationship(relationshipId: string): boolean;
    getRelationships(memoryId: string): RelationshipEdge[];
    getRecommendations(memoryId: string, limit?: number): RelationshipRecommendations;
    traverse(memoryId: string, maxDepth?: number): string[];
    validateIntegrity(): IntegrityReport;
    getGraph(): RelationshipGraphData;
    searchRelationships(query: {
        memoryId?: string;
        relationshipType?: RelationshipType;
        minStrength?: number;
    }): RelationshipEdge[];
    optimizeGraph(): {
        nodesRemoved: number;
        edgesRemoved: number;
    };
    buildStatusReport(): RelationshipMemoryStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private validateRelationshipInput;
    private ensureReady;
}
//# sourceMappingURL=relationship-memory-engine.d.ts.map
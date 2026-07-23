import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { RelationshipEdge, RelationshipGraphData, RelationshipNode, RelationshipType } from "./types.js";
export declare class RelationshipGraphStore {
    private graphPath;
    private graph;
    initialize(relationshipDir: string): void;
    getGraph(): RelationshipGraphData;
    ensureNode(memoryId: string, memoryType: MemoryStorageType): RelationshipNode;
    addEdge(edge: RelationshipEdge): boolean;
    updateEdge(relationshipId: string, updates: Partial<RelationshipEdge>): boolean;
    removeEdge(relationshipId: string): boolean;
    getEdgesFor(memoryId: string): RelationshipEdge[];
    getAllEdges(): RelationshipEdge[];
    removeNode(memoryId: string): void;
    createEdge(sourceId: string, targetId: string, sourceType: MemoryStorageType, targetType: MemoryStorageType, type: RelationshipType, reason: string, strength: number, confidence: number, engineSource?: string): RelationshipEdge | null;
    private persist;
}
//# sourceMappingURL=relationship-graph-store.d.ts.map
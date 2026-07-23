import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { KnowledgeGraphData, KnowledgeGraphEdge, KnowledgeGraphNode, KnowledgeNodeType, KnowledgeRelationType } from "./types.js";
export declare class KnowledgeGraphStore {
    private graphPath;
    private batchPersist;
    private graph;
    initialize(graphDir: string): void;
    setBatchPersist(enabled: boolean): void;
    flush(): void;
    getGraph(): KnowledgeGraphData;
    ensureKnowledgeNode(knowledgeId: string, knowledgeType: KnowledgeStorageType, title: string, searchableText: string): KnowledgeGraphNode;
    ensureNode(nodeId: string, nodeType: KnowledgeNodeType, title: string, searchableText: string, knowledgeType?: KnowledgeStorageType): KnowledgeGraphNode;
    addEdge(edge: KnowledgeGraphEdge): boolean;
    updateEdge(relationshipId: string, updates: Partial<KnowledgeGraphEdge>): boolean;
    removeEdge(relationshipId: string): boolean;
    getEdgesFor(nodeId: string): KnowledgeGraphEdge[];
    getAllEdges(): KnowledgeGraphEdge[];
    getNode(nodeId: string): KnowledgeGraphNode | undefined;
    getAllNodes(): KnowledgeGraphNode[];
    removeNode(nodeId: string): void;
    createEdge(sourceId: string, targetId: string, relationshipType: KnowledgeRelationType, evidence: string, strength: number, confidence: number, engineSource?: string): KnowledgeGraphEdge | null;
    private persist;
}
//# sourceMappingURL=knowledge-graph-store.d.ts.map
import { KnowledgeGraphStore } from "./knowledge-graph-store.js";
import { KnowledgeGraphEdge, KnowledgeGraphNode, GraphPathResult } from "./types.js";
export declare class KnowledgeGraphTraverser {
    private readonly graph;
    constructor(graph: KnowledgeGraphStore);
    traverse(nodeId: string, maxDepth?: number): string[];
    neighborhood(nodeId: string, depth?: number): string[];
    shortestPath(sourceId: string, targetId: string): GraphPathResult;
    findPath(sourceId: string, targetId: string, maxDepth?: number): GraphPathResult;
    private getNeighbors;
}
export declare class KnowledgeGraphSearcher {
    private readonly graph;
    constructor(graph: KnowledgeGraphStore);
    searchNodes(query: {
        text?: string;
        nodeType?: KnowledgeGraphNode["nodeType"];
        limit?: number;
    }): KnowledgeGraphNode[];
    searchRelationships(query: {
        nodeId?: string;
        relationshipType?: KnowledgeGraphEdge["relationshipType"];
        minStrength?: number;
        limit?: number;
    }): KnowledgeGraphEdge[];
    similaritySearch(nodeId: string, limit?: number): KnowledgeGraphNode[];
    private semanticScore;
}
//# sourceMappingURL=knowledge-graph-traverser.d.ts.map
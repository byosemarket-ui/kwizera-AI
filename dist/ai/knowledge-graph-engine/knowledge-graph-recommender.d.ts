import { KnowledgeGraphStore } from "./knowledge-graph-store.js";
import { KnowledgeGraphRecommendations } from "./types.js";
export declare class KnowledgeGraphRecommender {
    private readonly graph;
    constructor(graph: KnowledgeGraphStore);
    recommend(nodeId: string, limit?: number): KnowledgeGraphRecommendations;
}
//# sourceMappingURL=knowledge-graph-recommender.d.ts.map
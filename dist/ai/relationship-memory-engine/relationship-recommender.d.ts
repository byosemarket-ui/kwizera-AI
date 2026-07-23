import { RelationshipGraphStore } from "./relationship-graph-store.js";
import { RelationshipRecommendations } from "./types.js";
export declare class RelationshipRecommender {
    private readonly graph;
    constructor(graph: RelationshipGraphStore);
    recommend(memoryId: string, limit?: number): RelationshipRecommendations;
    traverse(memoryId: string, maxDepth?: number): string[];
}
//# sourceMappingURL=relationship-recommender.d.ts.map
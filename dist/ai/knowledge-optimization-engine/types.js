/**
 * KWIZERA AI STUDIO — Knowledge Optimization Engine types (Step 4L)
 */
export var KnowledgeTier;
(function (KnowledgeTier) {
    KnowledgeTier["Core"] = "core";
    KnowledgeTier["FrequentlyUsed"] = "frequently-used";
    KnowledgeTier["Creative"] = "creative";
    KnowledgeTier["Business"] = "business";
    KnowledgeTier["Industry"] = "industry";
    KnowledgeTier["Archived"] = "archived";
    KnowledgeTier["Historical"] = "historical";
    KnowledgeTier["Experimental"] = "experimental";
})(KnowledgeTier || (KnowledgeTier = {}));
export var KnowledgeOptimizationStrategy;
(function (KnowledgeOptimizationStrategy) {
    KnowledgeOptimizationStrategy["Classification"] = "classification";
    KnowledgeOptimizationStrategy["Relationship"] = "relationship";
    KnowledgeOptimizationStrategy["Graph"] = "graph";
    KnowledgeOptimizationStrategy["Semantic"] = "semantic";
    KnowledgeOptimizationStrategy["Recommendation"] = "recommendation";
    KnowledgeOptimizationStrategy["Metadata"] = "metadata";
    KnowledgeOptimizationStrategy["Search"] = "search";
    KnowledgeOptimizationStrategy["Index"] = "index";
    KnowledgeOptimizationStrategy["Cache"] = "cache";
    KnowledgeOptimizationStrategy["Deduplication"] = "deduplication";
})(KnowledgeOptimizationStrategy || (KnowledgeOptimizationStrategy = {}));
export class KnowledgeOptimizationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "KnowledgeOptimizationEngineError";
    }
}
//# sourceMappingURL=types.js.map
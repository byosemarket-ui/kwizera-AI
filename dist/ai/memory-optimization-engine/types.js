/**
 * KWIZERA AI STUDIO — Memory Optimization Engine types (Step 3K)
 */
export var MemoryTier;
(function (MemoryTier) {
    MemoryTier["Active"] = "active";
    MemoryTier["FrequentlyUsed"] = "frequently-used";
    MemoryTier["Learning"] = "learning";
    MemoryTier["Archived"] = "archived";
    MemoryTier["Historical"] = "historical";
    MemoryTier["System"] = "system";
})(MemoryTier || (MemoryTier = {}));
export var OptimizationStrategy;
(function (OptimizationStrategy) {
    OptimizationStrategy["Index"] = "index";
    OptimizationStrategy["Relationship"] = "relationship";
    OptimizationStrategy["Storage"] = "storage";
    OptimizationStrategy["Metadata"] = "metadata";
    OptimizationStrategy["Search"] = "search";
    OptimizationStrategy["Cache"] = "cache";
    OptimizationStrategy["Archive"] = "archive";
    OptimizationStrategy["Deduplication"] = "deduplication";
})(OptimizationStrategy || (OptimizationStrategy = {}));
export class MemoryOptimizationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MemoryOptimizationEngineError";
    }
}
//# sourceMappingURL=types.js.map
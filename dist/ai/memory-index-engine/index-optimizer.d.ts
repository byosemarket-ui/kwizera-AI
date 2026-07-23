import { InvertedIndexStore } from "./inverted-index-store.js";
import { MemoryIndexLogger } from "./index-logger.js";
export declare class IndexOptimizer {
    private readonly invertedStore;
    private readonly logger;
    constructor(invertedStore: InvertedIndexStore, logger: MemoryIndexLogger);
    optimize(): {
        optimizedTypes: number;
        removedEmpty: number;
        durationMs: number;
    };
}
//# sourceMappingURL=index-optimizer.d.ts.map
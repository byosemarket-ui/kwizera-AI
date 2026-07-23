import { IndexHealthReport } from "./types.js";
import { InvertedIndexStore } from "./inverted-index-store.js";
import { RelationshipIndex } from "./relationship-index.js";
import { MemoryIndexLogger } from "./index-logger.js";
export declare class IndexHealthChecker {
    private readonly invertedStore;
    private readonly relationshipIndex;
    private readonly logger;
    constructor(invertedStore: InvertedIndexStore, relationshipIndex: RelationshipIndex, logger: MemoryIndexLogger);
    runCheck(expectedRecordIds: string[]): IndexHealthReport;
}
//# sourceMappingURL=index-health-checker.d.ts.map
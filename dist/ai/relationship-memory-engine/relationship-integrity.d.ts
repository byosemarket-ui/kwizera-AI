import { RelationshipGraphStore } from "./relationship-graph-store.js";
import { RelationshipMemoryLogger } from "./relationship-logger.js";
import { IntegrityReport } from "./types.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
export declare class RelationshipIntegrityValidator {
    private readonly foundation;
    private readonly graph;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, graph: RelationshipGraphStore, logger: RelationshipMemoryLogger);
    validateAndRepair(): IntegrityReport;
    private detectCircularDependencies;
}
//# sourceMappingURL=relationship-integrity.d.ts.map
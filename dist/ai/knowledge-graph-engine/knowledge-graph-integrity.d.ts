import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeGraphStore } from "./knowledge-graph-store.js";
import { KnowledgeGraphLogger } from "./graph-logger.js";
import { GraphIntegrityReport } from "./types.js";
export declare class KnowledgeGraphIntegrityValidator {
    private readonly foundation;
    private readonly graph;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, graph: KnowledgeGraphStore, logger: KnowledgeGraphLogger);
    validateAndRepair(): GraphIntegrityReport;
    private detectDependencyCycles;
}
//# sourceMappingURL=knowledge-graph-integrity.d.ts.map
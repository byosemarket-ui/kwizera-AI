import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { RelationshipGraphStore } from "./relationship-graph-store.js";
import { RelationshipMemoryLogger } from "./relationship-logger.js";
import { RelationshipDiscoveryResult } from "./types.js";
export declare class RelationshipDiscovery {
    private readonly foundation;
    private readonly graph;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, graph: RelationshipGraphStore, logger: RelationshipMemoryLogger);
    discover(memoryId?: string): Promise<RelationshipDiscoveryResult>;
}
//# sourceMappingURL=relationship-discovery.d.ts.map
import type { MemoryRecord } from "../memory-storage-engine/types.js";
import { MemoryRelationshipNode, RelationshipGraph } from "./types.js";
import { MemoryIndexLogger } from "./index-logger.js";
export declare class RelationshipIndex {
    private readonly logger;
    private graphPath;
    private graph;
    constructor(logger: MemoryIndexLogger);
    initialize(indexesDir: string): void;
    buildFromRecord(record: MemoryRecord, allIds: string[]): MemoryRelationshipNode;
    removeNode(memoryId: string): void;
    getRelated(memoryId: string): string[];
    getGraph(): RelationshipGraph;
    clear(): void;
    private isRelated;
    private persist;
    verifyChecksum(): boolean;
}
//# sourceMappingURL=relationship-index.d.ts.map
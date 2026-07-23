import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MarketingMemoryLogger } from "./marketing-logger.js";
import { MarketingRelationships } from "./types.js";
export declare class MarketingRelationshipLinker {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, logger: MarketingMemoryLogger);
    link(campaignId: string, projectId: string, brand: string, product: string, tags?: string[]): MarketingRelationships;
}
//# sourceMappingURL=marketing-relationship-linker.d.ts.map
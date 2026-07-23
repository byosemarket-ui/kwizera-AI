import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { ProductMemoryLogger } from "./product-logger.js";
import { ProductRelationships } from "./types.js";
export declare class ProductRelationshipLinker {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, logger: ProductMemoryLogger);
    link(productId: string, projectId: string | undefined, brand: string, category: string, tags?: string[]): ProductRelationships;
}
//# sourceMappingURL=product-relationship-linker.d.ts.map
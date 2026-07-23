import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { ProductImageGenerationInput, ProductImageGenerationRecord, ProductImageGenerationRelationships } from "./types.js";
export declare class ProductImageGenerationLinker {
    detectRelationships(record: ProductImageGenerationRecord, input: ProductImageGenerationInput, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): ProductImageGenerationRelationships;
}
//# sourceMappingURL=product-image-generation-linker.d.ts.map
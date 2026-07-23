import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import { BackgroundGenerationInput, BackgroundGenerationRecord, BackgroundGenerationRelationships } from "./types.js";
export declare class BackgroundGenerationLinker {
    detectRelationships(record: BackgroundGenerationRecord, input: BackgroundGenerationInput, productImagePlan?: ProductImageGenerationRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): BackgroundGenerationRelationships;
}
//# sourceMappingURL=background-generation-linker.d.ts.map
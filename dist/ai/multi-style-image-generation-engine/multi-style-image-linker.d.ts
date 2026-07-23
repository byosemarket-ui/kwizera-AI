import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { BrandingDesignRecord } from "../branding-design-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import { MultiStyleImageInput, MultiStyleImageRecord, MultiStyleImageRelationships } from "./types.js";
export declare class MultiStyleImageLinker {
    detectRelationships(record: MultiStyleImageRecord, input: MultiStyleImageInput, productImagePlan?: ProductImageGenerationRecord | null, brandingPlan?: BrandingDesignRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): MultiStyleImageRelationships;
}
//# sourceMappingURL=multi-style-image-linker.d.ts.map
import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { ImageEnhancementRecord } from "../image-enhancement-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import { BrandingDesignInput, BrandingDesignRecord, BrandingDesignRelationships } from "./types.js";
export declare class BrandingDesignLinker {
    detectRelationships(record: BrandingDesignRecord, input: BrandingDesignInput, productImagePlan?: ProductImageGenerationRecord | null, enhancementPlan?: ImageEnhancementRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): BrandingDesignRelationships;
}
//# sourceMappingURL=branding-design-linker.d.ts.map
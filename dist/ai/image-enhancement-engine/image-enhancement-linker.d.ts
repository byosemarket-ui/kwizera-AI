import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { BackgroundGenerationRecord } from "../background-generation-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import type { ImageEditingRecord } from "../image-editing-engine/types.js";
import { ImageEnhancementInput, ImageEnhancementRecord, ImageEnhancementRelationships } from "./types.js";
export declare class ImageEnhancementLinker {
    detectRelationships(record: ImageEnhancementRecord, input: ImageEnhancementInput, productImagePlan?: ProductImageGenerationRecord | null, backgroundPlan?: BackgroundGenerationRecord | null, editingPlan?: ImageEditingRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): ImageEnhancementRelationships;
}
//# sourceMappingURL=image-enhancement-linker.d.ts.map
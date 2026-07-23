import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { BackgroundGenerationRecord } from "../background-generation-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import { ImageEditingInput, ImageEditingRecord, ImageEditingRelationships } from "./types.js";
export declare class ImageEditingLinker {
    detectRelationships(record: ImageEditingRecord, input: ImageEditingInput, productImagePlan?: ProductImageGenerationRecord | null, backgroundPlan?: BackgroundGenerationRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): ImageEditingRelationships;
}
//# sourceMappingURL=image-editing-linker.d.ts.map
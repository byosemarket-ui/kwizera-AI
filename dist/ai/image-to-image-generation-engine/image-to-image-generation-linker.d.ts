import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { TextToImageGenerationRecord } from "../text-to-image-generation-engine/types.js";
import { ImageToImageGenerationInput, ImageToImageGenerationRecord, ImageToImageRelationships } from "./types.js";
export declare class ImageToImageGenerationLinker {
    detectRelationships(record: ImageToImageGenerationRecord, input: ImageToImageGenerationInput, textToImagePlan?: TextToImageGenerationRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): ImageToImageRelationships;
}
//# sourceMappingURL=image-to-image-generation-linker.d.ts.map
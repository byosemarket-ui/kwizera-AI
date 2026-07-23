import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { TextToImageGenerationInput, TextToImageGenerationRecord, TextToImageRelationships } from "./types.js";
export declare class TextToImageGenerationLinker {
    detectRelationships(record: TextToImageGenerationRecord, input: TextToImageGenerationInput, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): TextToImageRelationships;
}
//# sourceMappingURL=text-to-image-generation-linker.d.ts.map
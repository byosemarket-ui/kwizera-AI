import type { BrandingDesignRecord } from "../branding-design-engine/types.js";
import type { MultiStyleImageRecord } from "../multi-style-image-generation-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import { ImageProductionInput, ImageProductionRecord, ImageProductionRelationships } from "./types.js";
export declare class ImageProductionLinker {
    detectRelationships(record: ImageProductionRecord, input: ImageProductionInput, productImagePlan?: ProductImageGenerationRecord | null, brandingPlan?: BrandingDesignRecord | null, stylePlan?: MultiStyleImageRecord | null): ImageProductionRelationships;
}
//# sourceMappingURL=image-production-linker.d.ts.map
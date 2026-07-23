import type { ImageProductionRecord } from "../image-production-engine/types.js";
import type { MultiStyleImageRecord } from "../multi-style-image-generation-engine/types.js";
import { ImageRenderInput, ImageRenderRecord, ImageRenderRelationships } from "./types.js";
export declare class ImageRenderLinker {
    detectRelationships(record: ImageRenderRecord, input: ImageRenderInput, productionPlan?: ImageProductionRecord | null, stylePlan?: MultiStyleImageRecord | null, productId?: string): ImageRenderRelationships;
}
//# sourceMappingURL=image-render-linker.d.ts.map
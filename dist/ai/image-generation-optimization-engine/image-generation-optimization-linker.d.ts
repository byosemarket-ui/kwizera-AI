import type { ImageQualityValidationRecord } from "../image-quality-validation-engine/types.js";
import type { ImageProductionRecord } from "../image-production-engine/types.js";
import type { ImageRenderRecord } from "../image-rendering-preparation-engine/types.js";
import { ImageGenerationOptimizationInput, ImageGenerationOptimizationRecord, OptimizationRelationships } from "./types.js";
export declare class ImageGenerationOptimizationLinker {
    detectRelationships(record: ImageGenerationOptimizationRecord, input: ImageGenerationOptimizationInput, validation?: ImageQualityValidationRecord | null, productionPlan?: ImageProductionRecord | null, renderPlan?: ImageRenderRecord | null): OptimizationRelationships;
}
//# sourceMappingURL=image-generation-optimization-linker.d.ts.map
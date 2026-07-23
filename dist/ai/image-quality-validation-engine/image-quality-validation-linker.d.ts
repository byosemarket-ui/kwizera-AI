import type { ImageProductionRecord } from "../image-production-engine/types.js";
import type { ImageRenderRecord } from "../image-rendering-preparation-engine/types.js";
import { ImageQualityValidationInput, ImageQualityValidationRecord, QualityValidationRelationships } from "./types.js";
export declare class ImageQualityValidationLinker {
    detectRelationships(record: ImageQualityValidationRecord, input: ImageQualityValidationInput, productionPlan?: ImageProductionRecord | null, renderPlan?: ImageRenderRecord | null): QualityValidationRelationships;
}
//# sourceMappingURL=image-quality-validation-linker.d.ts.map
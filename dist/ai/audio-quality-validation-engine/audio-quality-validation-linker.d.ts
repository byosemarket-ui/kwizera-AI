import type { AudioProductionRecord } from "../audio-production-engine/types.js";
import type { AudioRenderRecord } from "../audio-rendering-preparation-engine/types.js";
import { AudioQualityValidationInput, AudioQualityValidationRecord, AudioQualityValidationRelationships } from "./types.js";
export declare class AudioQualityValidationLinker {
    detectRelationships(record: AudioQualityValidationRecord, input: AudioQualityValidationInput, productionPlan?: AudioProductionRecord | null, renderPlan?: AudioRenderRecord | null): AudioQualityValidationRelationships;
}
//# sourceMappingURL=audio-quality-validation-linker.d.ts.map
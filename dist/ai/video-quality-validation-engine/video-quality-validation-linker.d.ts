import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { QualityValidationUpstreamAssets } from "./video-quality-validation-analyzer.js";
import { QualityValidationInput, QualityValidationRecord, QualityValidationRelationships } from "./types.js";
export declare class VideoQualityValidationLinker {
    detectRelationships(record: QualityValidationRecord, storyboard: StoryboardGenerationRecord, upstream: QualityValidationUpstreamAssets, input: QualityValidationInput): QualityValidationRelationships;
}
//# sourceMappingURL=video-quality-validation-linker.d.ts.map
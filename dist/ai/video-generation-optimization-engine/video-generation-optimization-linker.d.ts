import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { OptimizationUpstreamAssets } from "./video-generation-optimization-analyzer.js";
import { OptimizationRelationships, VideoGenerationOptimizationInput, VideoGenerationOptimizationRecord } from "./types.js";
export declare class VideoGenerationOptimizationLinker {
    detectRelationships(record: VideoGenerationOptimizationRecord, storyboard: StoryboardGenerationRecord, upstream: OptimizationUpstreamAssets, input: VideoGenerationOptimizationInput): OptimizationRelationships;
}
//# sourceMappingURL=video-generation-optimization-linker.d.ts.map
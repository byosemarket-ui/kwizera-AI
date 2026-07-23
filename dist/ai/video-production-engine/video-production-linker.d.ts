import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import { ProductionUpstreamAssets } from "./video-production-analyzer.js";
import { VideoProductionInput, VideoProductionRecord, VideoProductionRelationships } from "./types.js";
export declare class VideoProductionLinker {
    detectRelationships(record: VideoProductionRecord, storyboard: StoryboardGenerationRecord, upstream: ProductionUpstreamAssets, input: VideoProductionInput): VideoProductionRelationships;
}
//# sourceMappingURL=video-production-linker.d.ts.map
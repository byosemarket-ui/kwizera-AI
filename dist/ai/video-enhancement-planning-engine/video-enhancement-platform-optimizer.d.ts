import { VideoEnhancementPlatform, PlatformOptimizationRule } from "./types.js";
import { VideoAnalysisType, VideoOrientation } from "../video-analysis-engine/types.js";
export declare class VideoEnhancementPlatformOptimizer {
    buildPlatformRules(primaryPlatform: VideoEnhancementPlatform, videoType: VideoAnalysisType, orientation: VideoOrientation): PlatformOptimizationRule[];
    private priorityFor;
}
//# sourceMappingURL=video-enhancement-platform-optimizer.d.ts.map
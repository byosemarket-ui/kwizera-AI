/**
 * KWIZERA AI STUDIO — AI Video Generation Optimization Engine types (Step 8M)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export var OptimizationPlanType;
(function (OptimizationPlanType) {
    OptimizationPlanType["Standard"] = "standard";
    OptimizationPlanType["Performance"] = "performance";
    OptimizationPlanType["Resource"] = "resource";
    OptimizationPlanType["Combined"] = "combined";
})(OptimizationPlanType || (OptimizationPlanType = {}));
export class VideoGenerationOptimizationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoGenerationOptimizationEngineError";
    }
}
export const OPTIMIZATION_PLATFORM_TARGETS = [
    StoryboardGenerationPlatform.TikTok,
    StoryboardGenerationPlatform.InstagramReels,
    StoryboardGenerationPlatform.Facebook,
    StoryboardGenerationPlatform.YouTubeShorts,
    StoryboardGenerationPlatform.YouTubeLongForm,
    StoryboardGenerationPlatform.Website,
    StoryboardGenerationPlatform.Television,
];
//# sourceMappingURL=types.js.map
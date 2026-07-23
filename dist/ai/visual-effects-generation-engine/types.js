/**
 * KWIZERA AI STUDIO — Visual Effects Generation Engine types (Step 8G)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export var VisualEffectPlanType;
(function (VisualEffectPlanType) {
    VisualEffectPlanType["Lighting"] = "lighting";
    VisualEffectPlanType["Atmospheric"] = "atmospheric";
    VisualEffectPlanType["Product"] = "product";
    VisualEffectPlanType["Environment"] = "environment";
    VisualEffectPlanType["Transition"] = "transition";
    VisualEffectPlanType["TextGraphic"] = "text-graphic";
    VisualEffectPlanType["Color"] = "color";
    VisualEffectPlanType["Combined"] = "combined";
})(VisualEffectPlanType || (VisualEffectPlanType = {}));
export class VisualEffectsGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VisualEffectsGenerationEngineError";
    }
}
export const VFX_PLATFORM_TARGETS = [
    StoryboardGenerationPlatform.TikTok,
    StoryboardGenerationPlatform.InstagramReels,
    StoryboardGenerationPlatform.Facebook,
    StoryboardGenerationPlatform.YouTubeShorts,
    StoryboardGenerationPlatform.YouTubeLongForm,
    StoryboardGenerationPlatform.Website,
    StoryboardGenerationPlatform.Television,
];
export const PLATFORM_VFX_CONFIG = {
    [StoryboardGenerationPlatform.TikTok]: { effectIntensity: "high", renderComplexity: "optimized" },
    [StoryboardGenerationPlatform.InstagramReels]: { effectIntensity: "medium-high", renderComplexity: "balanced" },
    [StoryboardGenerationPlatform.Facebook]: { effectIntensity: "medium", renderComplexity: "balanced" },
    [StoryboardGenerationPlatform.YouTubeShorts]: { effectIntensity: "high", renderComplexity: "optimized" },
    [StoryboardGenerationPlatform.YouTubeLongForm]: { effectIntensity: "cinematic", renderComplexity: "full" },
    [StoryboardGenerationPlatform.WhatsApp]: { effectIntensity: "low-medium", renderComplexity: "light" },
    [StoryboardGenerationPlatform.Website]: { effectIntensity: "medium", renderComplexity: "balanced" },
    [StoryboardGenerationPlatform.Television]: { effectIntensity: "broadcast", renderComplexity: "full" },
};
//# sourceMappingURL=types.js.map
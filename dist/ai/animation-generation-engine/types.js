/**
 * KWIZERA AI STUDIO — Animation Generation Engine types (Step 8F)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export var AnimationPlanType;
(function (AnimationPlanType) {
    AnimationPlanType["Character"] = "character";
    AnimationPlanType["Product"] = "product";
    AnimationPlanType["Object"] = "object";
    AnimationPlanType["Text"] = "text";
    AnimationPlanType["Logo"] = "logo";
    AnimationPlanType["Environment"] = "environment";
    AnimationPlanType["Transition"] = "transition";
    AnimationPlanType["Combined"] = "combined";
})(AnimationPlanType || (AnimationPlanType = {}));
export class AnimationGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AnimationGenerationEngineError";
    }
}
export const ANIMATION_PLATFORM_TARGETS = [
    StoryboardGenerationPlatform.TikTok,
    StoryboardGenerationPlatform.InstagramReels,
    StoryboardGenerationPlatform.Facebook,
    StoryboardGenerationPlatform.YouTubeShorts,
    StoryboardGenerationPlatform.YouTubeLongForm,
    StoryboardGenerationPlatform.Website,
    StoryboardGenerationPlatform.Television,
];
export const PLATFORM_ANIMATION_CONFIG = {
    [StoryboardGenerationPlatform.TikTok]: { pacingStyle: "snappy", animationIntensity: "high" },
    [StoryboardGenerationPlatform.InstagramReels]: { pacingStyle: "rhythmic", animationIntensity: "medium-high" },
    [StoryboardGenerationPlatform.Facebook]: { pacingStyle: "moderate", animationIntensity: "medium" },
    [StoryboardGenerationPlatform.YouTubeShorts]: { pacingStyle: "punchy", animationIntensity: "high" },
    [StoryboardGenerationPlatform.YouTubeLongForm]: { pacingStyle: "cinematic", animationIntensity: "medium" },
    [StoryboardGenerationPlatform.WhatsApp]: { pacingStyle: "compact", animationIntensity: "low-medium" },
    [StoryboardGenerationPlatform.Website]: { pacingStyle: "smooth", animationIntensity: "medium" },
    [StoryboardGenerationPlatform.Television]: { pacingStyle: "broadcast", animationIntensity: "controlled" },
};
//# sourceMappingURL=types.js.map
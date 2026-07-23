/**
 * KWIZERA AI STUDIO — Scene Generation Engine types (Step 8C)
 */
import { CameraAngle, CameraMovement, ShotType, StoryboardGenerationPlatform, } from "../story-generation-engine/types.js";
export { CameraAngle, CameraMovement, ShotType, StoryboardGenerationPlatform };
export var SceneGenerationInputType;
(function (SceneGenerationInputType) {
    SceneGenerationInputType["Storyboard"] = "storyboard";
    SceneGenerationInputType["ProductInformation"] = "product-information";
    SceneGenerationInputType["BrandGuidelines"] = "brand-guidelines";
    SceneGenerationInputType["Campaign"] = "campaign";
    SceneGenerationInputType["Script"] = "script";
    SceneGenerationInputType["Image"] = "image";
    SceneGenerationInputType["Video"] = "video";
    SceneGenerationInputType["Audio"] = "audio";
    SceneGenerationInputType["KnowledgeRecord"] = "knowledge-record";
})(SceneGenerationInputType || (SceneGenerationInputType = {}));
export var SceneType;
(function (SceneType) {
    SceneType["Opening"] = "opening";
    SceneType["Hook"] = "hook";
    SceneType["Introduction"] = "introduction";
    SceneType["Problem"] = "problem";
    SceneType["Solution"] = "solution";
    SceneType["ProductShowcase"] = "product-showcase";
    SceneType["Benefits"] = "benefits";
    SceneType["SocialProof"] = "social-proof";
    SceneType["CallToAction"] = "call-to-action";
    SceneType["Ending"] = "ending";
    SceneType["Transition"] = "transition";
    SceneType["Custom"] = "custom";
})(SceneType || (SceneType = {}));
export var ScenePriority;
(function (ScenePriority) {
    ScenePriority["Critical"] = "critical";
    ScenePriority["High"] = "high";
    ScenePriority["Medium"] = "medium";
    ScenePriority["Low"] = "low";
})(ScenePriority || (ScenePriority = {}));
export class SceneGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "SceneGenerationEngineError";
    }
}
export const SCENE_PLATFORM_TARGETS = [
    StoryboardGenerationPlatform.TikTok,
    StoryboardGenerationPlatform.InstagramReels,
    StoryboardGenerationPlatform.Facebook,
    StoryboardGenerationPlatform.YouTubeShorts,
    StoryboardGenerationPlatform.YouTubeLongForm,
    StoryboardGenerationPlatform.Website,
    StoryboardGenerationPlatform.Television,
];
export const PLATFORM_SCENE_CONFIG = {
    [StoryboardGenerationPlatform.TikTok]: { aspectRatio: "9:16", durationGuidance: "5-8s per scene" },
    [StoryboardGenerationPlatform.InstagramReels]: { aspectRatio: "9:16", durationGuidance: "6-10s per scene" },
    [StoryboardGenerationPlatform.Facebook]: { aspectRatio: "1:1", durationGuidance: "8-12s per scene" },
    [StoryboardGenerationPlatform.YouTubeShorts]: { aspectRatio: "9:16", durationGuidance: "5-9s per scene" },
    [StoryboardGenerationPlatform.YouTubeLongForm]: { aspectRatio: "16:9", durationGuidance: "10-15s per scene" },
    [StoryboardGenerationPlatform.WhatsApp]: { aspectRatio: "9:16", durationGuidance: "7-10s per scene" },
    [StoryboardGenerationPlatform.Website]: { aspectRatio: "16:9", durationGuidance: "8-12s per scene" },
    [StoryboardGenerationPlatform.Television]: { aspectRatio: "16:9", durationGuidance: "broadcast-safe pacing" },
};
export function mapPurposeToSceneType(purpose) {
    const map = {
        "opening-hook": SceneType.Hook,
        introduction: SceneType.Introduction,
        problem: SceneType.Problem,
        solution: SceneType.Solution,
        "product-showcase": SceneType.ProductShowcase,
        benefits: SceneType.Benefits,
        "social-proof": SceneType.SocialProof,
        "call-to-action": SceneType.CallToAction,
        ending: SceneType.Ending,
    };
    return map[purpose] ?? SceneType.Custom;
}
export function mapPurposeToPriority(purpose) {
    if (["opening-hook", "call-to-action", "product-showcase"].includes(purpose))
        return ScenePriority.Critical;
    if (["hook", "solution", "benefits"].includes(purpose))
        return ScenePriority.High;
    if (["introduction", "social-proof"].includes(purpose))
        return ScenePriority.Medium;
    return ScenePriority.Low;
}
//# sourceMappingURL=types.js.map
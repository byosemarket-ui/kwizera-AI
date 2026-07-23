/**
 * KWIZERA AI STUDIO — Motion Generation Engine types (Step 8E)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export var MotionType;
(function (MotionType) {
    MotionType["Character"] = "character";
    MotionType["Product"] = "product";
    MotionType["Object"] = "object";
    MotionType["Camera"] = "camera";
    MotionType["Environment"] = "environment";
    MotionType["Combined"] = "combined";
})(MotionType || (MotionType = {}));
export var CharacterMotionAction;
(function (CharacterMotionAction) {
    CharacterMotionAction["Walking"] = "walking";
    CharacterMotionAction["Running"] = "running";
    CharacterMotionAction["Turning"] = "turning";
    CharacterMotionAction["Looking"] = "looking";
    CharacterMotionAction["Gestures"] = "gestures";
    CharacterMotionAction["FacialExpressions"] = "facial-expressions";
    CharacterMotionAction["BodyLanguage"] = "body-language";
    CharacterMotionAction["Interaction"] = "interaction";
})(CharacterMotionAction || (CharacterMotionAction = {}));
export var ProductMotionAction;
(function (ProductMotionAction) {
    ProductMotionAction["Rotation"] = "rotation";
    ProductMotionAction["Reveal"] = "reveal";
    ProductMotionAction["ZoomPresentation"] = "zoom-presentation";
    ProductMotionAction["ShowcaseMotion"] = "showcase-motion";
    ProductMotionAction["Floating"] = "floating";
    ProductMotionAction["Placement"] = "placement";
    ProductMotionAction["HighlightMotion"] = "highlight-motion";
})(ProductMotionAction || (ProductMotionAction = {}));
export var ObjectMotionAction;
(function (ObjectMotionAction) {
    ObjectMotionAction["Entry"] = "entry";
    ObjectMotionAction["Exit"] = "exit";
    ObjectMotionAction["Interaction"] = "interaction";
    ObjectMotionAction["PhysicsBased"] = "physics-based";
    ObjectMotionAction["CollisionPlanning"] = "collision-planning";
    ObjectMotionAction["EnvironmentalInteraction"] = "environmental-interaction";
})(ObjectMotionAction || (ObjectMotionAction = {}));
export var EnvironmentMotionType;
(function (EnvironmentMotionType) {
    EnvironmentMotionType["Wind"] = "wind";
    EnvironmentMotionType["Rain"] = "rain";
    EnvironmentMotionType["Smoke"] = "smoke";
    EnvironmentMotionType["Fire"] = "fire";
    EnvironmentMotionType["Water"] = "water";
    EnvironmentMotionType["LightRays"] = "light-rays";
    EnvironmentMotionType["Particles"] = "particles";
    EnvironmentMotionType["BackgroundMotion"] = "background-motion";
})(EnvironmentMotionType || (EnvironmentMotionType = {}));
export class MotionGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MotionGenerationEngineError";
    }
}
export const MOTION_PLATFORM_TARGETS = [
    StoryboardGenerationPlatform.TikTok,
    StoryboardGenerationPlatform.InstagramReels,
    StoryboardGenerationPlatform.Facebook,
    StoryboardGenerationPlatform.YouTubeShorts,
    StoryboardGenerationPlatform.YouTubeLongForm,
    StoryboardGenerationPlatform.Website,
    StoryboardGenerationPlatform.Television,
];
export const PLATFORM_MOTION_CONFIG = {
    [StoryboardGenerationPlatform.TikTok]: { pacingStyle: "fast-dynamic", movementIntensity: "high" },
    [StoryboardGenerationPlatform.InstagramReels]: { pacingStyle: "rhythmic", movementIntensity: "medium-high" },
    [StoryboardGenerationPlatform.Facebook]: { pacingStyle: "moderate", movementIntensity: "medium" },
    [StoryboardGenerationPlatform.YouTubeShorts]: { pacingStyle: "punchy", movementIntensity: "high" },
    [StoryboardGenerationPlatform.YouTubeLongForm]: { pacingStyle: "cinematic", movementIntensity: "medium" },
    [StoryboardGenerationPlatform.WhatsApp]: { pacingStyle: "compact", movementIntensity: "low-medium" },
    [StoryboardGenerationPlatform.Website]: { pacingStyle: "smooth-professional", movementIntensity: "medium" },
    [StoryboardGenerationPlatform.Television]: { pacingStyle: "broadcast-stable", movementIntensity: "controlled" },
};
//# sourceMappingURL=types.js.map
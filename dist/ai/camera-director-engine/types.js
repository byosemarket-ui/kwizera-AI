/**
 * KWIZERA AI STUDIO — Camera Director Engine types (Step 8D)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export var DirectorShotType;
(function (DirectorShotType) {
    DirectorShotType["Establishing"] = "establishing-shot";
    DirectorShotType["Hero"] = "hero-shot";
    DirectorShotType["Wide"] = "wide-shot";
    DirectorShotType["Medium"] = "medium-shot";
    DirectorShotType["CloseUp"] = "close-up";
    DirectorShotType["ExtremeCloseUp"] = "extreme-close-up";
    DirectorShotType["Detail"] = "detail-shot";
    DirectorShotType["OverTheShoulder"] = "over-the-shoulder";
    DirectorShotType["PointOfView"] = "point-of-view";
    DirectorShotType["Tracking"] = "tracking-shot";
})(DirectorShotType || (DirectorShotType = {}));
export var DirectorCameraAngle;
(function (DirectorCameraAngle) {
    DirectorCameraAngle["EyeLevel"] = "eye-level";
    DirectorCameraAngle["HighAngle"] = "high-angle";
    DirectorCameraAngle["LowAngle"] = "low-angle";
    DirectorCameraAngle["BirdsEye"] = "birds-eye";
    DirectorCameraAngle["WormsEye"] = "worms-eye";
    DirectorCameraAngle["DutchAngle"] = "dutch-angle";
    DirectorCameraAngle["Front"] = "front";
    DirectorCameraAngle["Side"] = "side";
    DirectorCameraAngle["Rear"] = "rear";
})(DirectorCameraAngle || (DirectorCameraAngle = {}));
export var DirectorCameraMovement;
(function (DirectorCameraMovement) {
    DirectorCameraMovement["Static"] = "static";
    DirectorCameraMovement["Pan"] = "pan";
    DirectorCameraMovement["Tilt"] = "tilt";
    DirectorCameraMovement["Zoom"] = "zoom";
    DirectorCameraMovement["Dolly"] = "dolly";
    DirectorCameraMovement["Truck"] = "truck";
    DirectorCameraMovement["Pedestal"] = "pedestal";
    DirectorCameraMovement["Crane"] = "crane";
    DirectorCameraMovement["Orbit"] = "orbit";
    DirectorCameraMovement["Follow"] = "follow";
    DirectorCameraMovement["PushIn"] = "push-in";
    DirectorCameraMovement["PullOut"] = "pull-out";
    DirectorCameraMovement["HandheldStyle"] = "handheld-style";
    DirectorCameraMovement["GimbalStyle"] = "gimbal-style";
    DirectorCameraMovement["DroneStyle"] = "drone-style";
})(DirectorCameraMovement || (DirectorCameraMovement = {}));
export var CompositionStrategy;
(function (CompositionStrategy) {
    CompositionStrategy["RuleOfThirds"] = "rule-of-thirds";
    CompositionStrategy["LeadingLines"] = "leading-lines";
    CompositionStrategy["CenterComposition"] = "center-composition";
    CompositionStrategy["Symmetry"] = "symmetry";
    CompositionStrategy["NegativeSpace"] = "negative-space";
    CompositionStrategy["ProductHighlight"] = "product-highlight";
    CompositionStrategy["BrandVisibility"] = "brand-visibility";
})(CompositionStrategy || (CompositionStrategy = {}));
export class CameraDirectorEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "CameraDirectorEngineError";
    }
}
export const CAMERA_PLATFORM_TARGETS = [
    StoryboardGenerationPlatform.TikTok,
    StoryboardGenerationPlatform.InstagramReels,
    StoryboardGenerationPlatform.Facebook,
    StoryboardGenerationPlatform.YouTubeShorts,
    StoryboardGenerationPlatform.YouTubeLongForm,
    StoryboardGenerationPlatform.Website,
    StoryboardGenerationPlatform.Television,
];
export const PLATFORM_CAMERA_CONFIG = {
    [StoryboardGenerationPlatform.TikTok]: { aspectRatio: "9:16", movementStyle: "gimbal-style", anglePreference: "eye-level" },
    [StoryboardGenerationPlatform.InstagramReels]: { aspectRatio: "9:16", movementStyle: "gimbal-style", anglePreference: "low-angle" },
    [StoryboardGenerationPlatform.Facebook]: { aspectRatio: "1:1", movementStyle: "static", anglePreference: "eye-level" },
    [StoryboardGenerationPlatform.YouTubeShorts]: { aspectRatio: "9:16", movementStyle: "push-in", anglePreference: "eye-level" },
    [StoryboardGenerationPlatform.YouTubeLongForm]: { aspectRatio: "16:9", movementStyle: "dolly", anglePreference: "eye-level" },
    [StoryboardGenerationPlatform.WhatsApp]: { aspectRatio: "9:16", movementStyle: "handheld-style", anglePreference: "eye-level" },
    [StoryboardGenerationPlatform.Website]: { aspectRatio: "16:9", movementStyle: "crane", anglePreference: "eye-level" },
    [StoryboardGenerationPlatform.Television]: { aspectRatio: "16:9", movementStyle: "crane", anglePreference: "eye-level" },
};
export function mapSceneShotToDirectorShot(shotType, purpose) {
    if (purpose === "opening-hook")
        return DirectorShotType.Establishing;
    if (purpose === "product-showcase")
        return DirectorShotType.Hero;
    if (purpose === "call-to-action")
        return DirectorShotType.CloseUp;
    if (shotType === "wide")
        return DirectorShotType.Wide;
    if (shotType === "close-up" || shotType === "extreme-close-up")
        return DirectorShotType.CloseUp;
    if (shotType === "over-the-shoulder")
        return DirectorShotType.OverTheShoulder;
    if (shotType === "pov")
        return DirectorShotType.PointOfView;
    if (shotType === "medium")
        return DirectorShotType.Medium;
    return DirectorShotType.Medium;
}
export function mapSceneAngleToDirector(angle) {
    const map = {
        "eye-level": DirectorCameraAngle.EyeLevel,
        "low-angle": DirectorCameraAngle.LowAngle,
        "high-angle": DirectorCameraAngle.HighAngle,
        dutch: DirectorCameraAngle.DutchAngle,
        "bird-eye": DirectorCameraAngle.BirdsEye,
        "worm-eye": DirectorCameraAngle.WormsEye,
    };
    return map[angle] ?? DirectorCameraAngle.EyeLevel;
}
export function mapSceneMovementToDirector(movement) {
    const map = {
        static: DirectorCameraMovement.Static,
        pan: DirectorCameraMovement.Pan,
        tilt: DirectorCameraMovement.Tilt,
        dolly: DirectorCameraMovement.Dolly,
        tracking: DirectorCameraMovement.Follow,
        crane: DirectorCameraMovement.Crane,
        handheld: DirectorCameraMovement.HandheldStyle,
        zoom: DirectorCameraMovement.Zoom,
    };
    return map[movement] ?? DirectorCameraMovement.Static;
}
//# sourceMappingURL=types.js.map
/**
 * KWIZERA AI STUDIO — Camera Movement Intelligence Engine types (Step 7F)
 */
export var CameraMovementType;
(function (CameraMovementType) {
    CameraMovementType["Static"] = "static";
    CameraMovementType["Pan"] = "pan";
    CameraMovementType["Tilt"] = "tilt";
    CameraMovementType["ZoomIn"] = "zoom-in";
    CameraMovementType["ZoomOut"] = "zoom-out";
    CameraMovementType["DollyIn"] = "dolly-in";
    CameraMovementType["DollyOut"] = "dolly-out";
    CameraMovementType["TruckLeft"] = "truck-left";
    CameraMovementType["TruckRight"] = "truck-right";
    CameraMovementType["PedestalUp"] = "pedestal-up";
    CameraMovementType["PedestalDown"] = "pedestal-down";
    CameraMovementType["Crane"] = "crane";
    CameraMovementType["Orbit"] = "orbit";
    CameraMovementType["Handheld"] = "handheld";
    CameraMovementType["Gimbal"] = "gimbal";
    CameraMovementType["Drone"] = "drone";
    CameraMovementType["TrackingShot"] = "tracking-shot";
    CameraMovementType["FollowShot"] = "follow-shot";
    CameraMovementType["PushIn"] = "push-in";
    CameraMovementType["PullOut"] = "pull-out";
})(CameraMovementType || (CameraMovementType = {}));
export var CameraAngle;
(function (CameraAngle) {
    CameraAngle["EyeLevel"] = "eye-level";
    CameraAngle["LowAngle"] = "low-angle";
    CameraAngle["HighAngle"] = "high-angle";
    CameraAngle["BirdsEye"] = "birds-eye";
    CameraAngle["WormsEye"] = "worms-eye";
    CameraAngle["Overhead"] = "overhead";
    CameraAngle["SideView"] = "side-view";
    CameraAngle["FrontView"] = "front-view";
    CameraAngle["RearView"] = "rear-view";
    CameraAngle["DutchAngle"] = "dutch-angle";
})(CameraAngle || (CameraAngle = {}));
export var ShotFraming;
(function (ShotFraming) {
    ShotFraming["ExtremeWideShot"] = "extreme-wide-shot";
    ShotFraming["WideShot"] = "wide-shot";
    ShotFraming["FullShot"] = "full-shot";
    ShotFraming["MediumShot"] = "medium-shot";
    ShotFraming["MediumCloseUp"] = "medium-close-up";
    ShotFraming["CloseUp"] = "close-up";
    ShotFraming["ExtremeCloseUp"] = "extreme-close-up";
    ShotFraming["HeroShot"] = "hero-shot";
})(ShotFraming || (ShotFraming = {}));
export var CameraStabilityLevel;
(function (CameraStabilityLevel) {
    CameraStabilityLevel["Stable"] = "stable";
    CameraStabilityLevel["SlightShake"] = "slight-shake";
    CameraStabilityLevel["HeavyShake"] = "heavy-shake";
})(CameraStabilityLevel || (CameraStabilityLevel = {}));
export var CinematicPurpose;
(function (CinematicPurpose) {
    CinematicPurpose["ProductShowcase"] = "product-showcase";
    CinematicPurpose["EmotionalImpact"] = "emotional-impact";
    CinematicPurpose["Storytelling"] = "storytelling";
    CinematicPurpose["MarketingFocus"] = "marketing-focus";
    CinematicPurpose["AudienceAttention"] = "audience-attention";
    CinematicPurpose["CtaFocus"] = "cta-focus";
})(CinematicPurpose || (CinematicPurpose = {}));
export class CameraMovementEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "CameraMovementEngineError";
    }
}
//# sourceMappingURL=types.js.map
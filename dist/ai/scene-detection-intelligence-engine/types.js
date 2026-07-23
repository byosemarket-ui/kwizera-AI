/**
 * KWIZERA AI STUDIO — Scene Detection Intelligence Engine types (Step 7D)
 */
export var SceneClassification;
(function (SceneClassification) {
    SceneClassification["Intro"] = "intro";
    SceneClassification["Hook"] = "hook";
    SceneClassification["ProductDemo"] = "product-demo";
    SceneClassification["BrandScene"] = "brand-scene";
    SceneClassification["Testimonial"] = "testimonial";
    SceneClassification["Cta"] = "cta";
    SceneClassification["Outro"] = "outro";
    SceneClassification["BRoll"] = "b-roll";
    SceneClassification["Other"] = "other";
})(SceneClassification || (SceneClassification = {}));
export var ShotType;
(function (ShotType) {
    ShotType["Wide"] = "wide";
    ShotType["Medium"] = "medium";
    ShotType["CloseUp"] = "close-up";
    ShotType["ExtremeCloseUp"] = "extreme-close-up";
    ShotType["Establishing"] = "establishing";
    ShotType["Insert"] = "insert";
    ShotType["Other"] = "other";
})(ShotType || (ShotType = {}));
export var TransitionType;
(function (TransitionType) {
    TransitionType["Cut"] = "cut";
    TransitionType["Fade"] = "fade";
    TransitionType["Dissolve"] = "dissolve";
    TransitionType["Wipe"] = "wipe";
    TransitionType["ZoomTransition"] = "zoom-transition";
    TransitionType["Custom"] = "custom";
})(TransitionType || (TransitionType = {}));
export var ScenePriority;
(function (ScenePriority) {
    ScenePriority["Critical"] = "critical";
    ScenePriority["High"] = "high";
    ScenePriority["Medium"] = "medium";
    ScenePriority["Low"] = "low";
})(ScenePriority || (ScenePriority = {}));
export class SceneDetectionEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "SceneDetectionEngineError";
    }
}
//# sourceMappingURL=types.js.map
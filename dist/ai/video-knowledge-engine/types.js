/**
 * KWIZERA AI STUDIO — Video Knowledge Engine types (Step 4F)
 */
export var VideoType;
(function (VideoType) {
    VideoType["Promotional"] = "promotional";
    VideoType["Product"] = "product";
    VideoType["Marketing"] = "marketing";
    VideoType["Brand"] = "brand";
    VideoType["Tutorial"] = "tutorial";
    VideoType["Social"] = "social";
    VideoType["Commercial"] = "commercial";
    VideoType["Cinematic"] = "cinematic";
})(VideoType || (VideoType = {}));
export var EditingStyle;
(function (EditingStyle) {
    EditingStyle["Cinematic"] = "cinematic";
    EditingStyle["Commercial"] = "commercial";
    EditingStyle["FastPaced"] = "fast-paced";
    EditingStyle["Minimal"] = "minimal";
    EditingStyle["Documentary"] = "documentary";
})(EditingStyle || (EditingStyle = {}));
export var CameraShotType;
(function (CameraShotType) {
    CameraShotType["Static"] = "static";
    CameraShotType["Pan"] = "pan";
    CameraShotType["Tilt"] = "tilt";
    CameraShotType["Zoom"] = "zoom";
    CameraShotType["Dolly"] = "dolly";
    CameraShotType["Tracking"] = "tracking";
    CameraShotType["Orbit"] = "orbit";
    CameraShotType["CloseUp"] = "close-up";
    CameraShotType["Medium"] = "medium";
    CameraShotType["Wide"] = "wide";
    CameraShotType["ProductShowcase"] = "product-showcase";
})(CameraShotType || (CameraShotType = {}));
export class VideoKnowledgeEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoKnowledgeEngineError";
    }
}
//# sourceMappingURL=types.js.map
/**
 * KWIZERA AI STUDIO — Timeline Intelligence Engine types (Step 7E)
 */
export var TimelineVariant;
(function (TimelineVariant) {
    TimelineVariant["Main"] = "main";
    TimelineVariant["ShortVersion"] = "short-version";
    TimelineVariant["Trailer"] = "trailer";
    TimelineVariant["Teaser"] = "teaser";
    TimelineVariant["SocialMedia"] = "social-media";
    TimelineVariant["PlatformSpecific"] = "platform-specific";
})(TimelineVariant || (TimelineVariant = {}));
export var TrackType;
(function (TrackType) {
    TrackType["Video"] = "video";
    TrackType["Audio"] = "audio";
    TrackType["Voice"] = "voice";
    TrackType["Subtitle"] = "subtitle";
    TrackType["Caption"] = "caption";
    TrackType["Effects"] = "effects";
    TrackType["MotionGraphics"] = "motion-graphics";
    TrackType["Overlay"] = "overlay";
    TrackType["Adjustment"] = "adjustment";
})(TrackType || (TrackType = {}));
export class TimelineIntelligenceEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "TimelineIntelligenceEngineError";
    }
}
//# sourceMappingURL=types.js.map
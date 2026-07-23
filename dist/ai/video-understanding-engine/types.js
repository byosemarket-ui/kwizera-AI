/**
 * KWIZERA AI STUDIO — Video Understanding Engine types (Step 7C)
 */
export var VideoUnderstandingMarketingGoal;
(function (VideoUnderstandingMarketingGoal) {
    VideoUnderstandingMarketingGoal["Conversion"] = "conversion";
    VideoUnderstandingMarketingGoal["Awareness"] = "awareness";
    VideoUnderstandingMarketingGoal["Engagement"] = "engagement";
    VideoUnderstandingMarketingGoal["Retention"] = "retention";
    VideoUnderstandingMarketingGoal["Launch"] = "launch";
    VideoUnderstandingMarketingGoal["Education"] = "education";
})(VideoUnderstandingMarketingGoal || (VideoUnderstandingMarketingGoal = {}));
export var VideoStoryType;
(function (VideoStoryType) {
    VideoStoryType["ProblemSolution"] = "problem-solution";
    VideoStoryType["ProductDemo"] = "product-demo";
    VideoStoryType["BrandStory"] = "brand-story";
    VideoStoryType["Tutorial"] = "tutorial";
    VideoStoryType["Testimonial"] = "testimonial";
    VideoStoryType["Lifestyle"] = "lifestyle";
    VideoStoryType["Promotional"] = "promotional";
    VideoStoryType["Documentary"] = "documentary";
    VideoStoryType["Interview"] = "interview";
    VideoStoryType["Other"] = "other";
})(VideoStoryType || (VideoStoryType = {}));
export var VideoSceneRole;
(function (VideoSceneRole) {
    VideoSceneRole["Opening"] = "opening";
    VideoSceneRole["Hook"] = "hook";
    VideoSceneRole["MainContent"] = "main-content";
    VideoSceneRole["ProductDemonstration"] = "product-demonstration";
    VideoSceneRole["Promotional"] = "promotional";
    VideoSceneRole["Cta"] = "cta";
    VideoSceneRole["Ending"] = "ending";
})(VideoSceneRole || (VideoSceneRole = {}));
export class VideoUnderstandingEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoUnderstandingEngineError";
    }
}
//# sourceMappingURL=types.js.map
/**
 * KWIZERA AI STUDIO — AI Video Quality Validation Engine types (Step 8L)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export var QualityValidationType;
(function (QualityValidationType) {
    QualityValidationType["Standard"] = "standard";
    QualityValidationType["PreRender"] = "pre-render";
    QualityValidationType["Comprehensive"] = "comprehensive";
    QualityValidationType["Combined"] = "combined";
})(QualityValidationType || (QualityValidationType = {}));
export var QualityIssueSeverity;
(function (QualityIssueSeverity) {
    QualityIssueSeverity["Low"] = "low";
    QualityIssueSeverity["Medium"] = "medium";
    QualityIssueSeverity["High"] = "high";
    QualityIssueSeverity["Critical"] = "critical";
})(QualityIssueSeverity || (QualityIssueSeverity = {}));
export var QualityIssueCategory;
(function (QualityIssueCategory) {
    QualityIssueCategory["MissingAsset"] = "missing-asset";
    QualityIssueCategory["BrokenTimeline"] = "broken-timeline";
    QualityIssueCategory["BrokenRelationship"] = "broken-relationship";
    QualityIssueCategory["Visual"] = "visual";
    QualityIssueCategory["Audio"] = "audio";
    QualityIssueCategory["Subtitle"] = "subtitle";
    QualityIssueCategory["Brand"] = "brand";
    QualityIssueCategory["RenderingRisk"] = "rendering-risk";
    QualityIssueCategory["Technical"] = "technical";
})(QualityIssueCategory || (QualityIssueCategory = {}));
export class VideoQualityValidationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoQualityValidationEngineError";
    }
}
export const QUALITY_PLATFORM_TARGETS = [
    StoryboardGenerationPlatform.TikTok,
    StoryboardGenerationPlatform.InstagramReels,
    StoryboardGenerationPlatform.Facebook,
    StoryboardGenerationPlatform.YouTubeShorts,
    StoryboardGenerationPlatform.YouTubeLongForm,
    StoryboardGenerationPlatform.Website,
    StoryboardGenerationPlatform.Television,
];
export const PLATFORM_QUALITY_CONFIG = {
    [StoryboardGenerationPlatform.TikTok]: { resolution: "1080x1920", aspectRatio: "9:16", maxDuration: "60s" },
    [StoryboardGenerationPlatform.InstagramReels]: { resolution: "1080x1920", aspectRatio: "9:16", maxDuration: "90s" },
    [StoryboardGenerationPlatform.Facebook]: { resolution: "1080x1080", aspectRatio: "1:1", maxDuration: "120s" },
    [StoryboardGenerationPlatform.YouTubeShorts]: { resolution: "1080x1920", aspectRatio: "9:16", maxDuration: "60s" },
    [StoryboardGenerationPlatform.YouTubeLongForm]: { resolution: "3840x2160", aspectRatio: "16:9", maxDuration: "600s" },
    [StoryboardGenerationPlatform.WhatsApp]: { resolution: "720x1280", aspectRatio: "9:16", maxDuration: "30s" },
    [StoryboardGenerationPlatform.Website]: { resolution: "1920x1080", aspectRatio: "16:9", maxDuration: "120s" },
    [StoryboardGenerationPlatform.Television]: { resolution: "3840x2160", aspectRatio: "16:9", maxDuration: "30s" },
};
//# sourceMappingURL=types.js.map
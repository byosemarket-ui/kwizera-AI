/**
 * KWIZERA AI STUDIO — Video Production Engine types (Step 8J)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export var ProductionPlanType;
(function (ProductionPlanType) {
    ProductionPlanType["Standard"] = "standard";
    ProductionPlanType["PlatformOptimized"] = "platform-optimized";
    ProductionPlanType["Campaign"] = "campaign";
    ProductionPlanType["Combined"] = "combined";
})(ProductionPlanType || (ProductionPlanType = {}));
export var ExportFormat;
(function (ExportFormat) {
    ExportFormat["Mp4"] = "mp4";
    ExportFormat["Mov"] = "mov";
    ExportFormat["Mkv"] = "mkv";
    ExportFormat["Webm"] = "webm";
    ExportFormat["Gif"] = "gif";
})(ExportFormat || (ExportFormat = {}));
export class VideoProductionEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoProductionEngineError";
    }
}
export const PRODUCTION_PLATFORM_TARGETS = [
    StoryboardGenerationPlatform.TikTok,
    StoryboardGenerationPlatform.InstagramReels,
    StoryboardGenerationPlatform.Facebook,
    StoryboardGenerationPlatform.YouTubeShorts,
    StoryboardGenerationPlatform.YouTubeLongForm,
    StoryboardGenerationPlatform.WhatsApp,
    StoryboardGenerationPlatform.Website,
    StoryboardGenerationPlatform.Television,
];
export const PLATFORM_PRODUCTION_CONFIG = {
    [StoryboardGenerationPlatform.TikTok]: { resolution: "1080x1920", aspectRatio: "9:16", maxDuration: "60s" },
    [StoryboardGenerationPlatform.InstagramReels]: { resolution: "1080x1920", aspectRatio: "9:16", maxDuration: "90s" },
    [StoryboardGenerationPlatform.Facebook]: { resolution: "1080x1080", aspectRatio: "1:1", maxDuration: "120s" },
    [StoryboardGenerationPlatform.YouTubeShorts]: { resolution: "1080x1920", aspectRatio: "9:16", maxDuration: "60s" },
    [StoryboardGenerationPlatform.YouTubeLongForm]: { resolution: "3840x2160", aspectRatio: "16:9", maxDuration: "600s" },
    [StoryboardGenerationPlatform.WhatsApp]: { resolution: "720x1280", aspectRatio: "9:16", maxDuration: "30s" },
    [StoryboardGenerationPlatform.Website]: { resolution: "1920x1080", aspectRatio: "16:9", maxDuration: "120s" },
    [StoryboardGenerationPlatform.Television]: { resolution: "3840x2160", aspectRatio: "16:9", maxDuration: "30s" },
};
export const SUPPORTED_EXPORT_FORMATS = [
    ExportFormat.Mp4,
    ExportFormat.Mov,
    ExportFormat.Mkv,
    ExportFormat.Webm,
    ExportFormat.Gif,
];
//# sourceMappingURL=types.js.map
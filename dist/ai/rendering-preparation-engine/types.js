/**
 * KWIZERA AI STUDIO — AI Rendering Preparation Engine types (Step 8K)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export var RenderPlanType;
(function (RenderPlanType) {
    RenderPlanType["Standard"] = "standard";
    RenderPlanType["PlatformOptimized"] = "platform-optimized";
    RenderPlanType["MultiOutput"] = "multi-output";
    RenderPlanType["Combined"] = "combined";
})(RenderPlanType || (RenderPlanType = {}));
export var RenderOutputPlatform;
(function (RenderOutputPlatform) {
    RenderOutputPlatform["TikTok"] = "tiktok";
    RenderOutputPlatform["InstagramReels"] = "instagram-reels";
    RenderOutputPlatform["Facebook"] = "facebook";
    RenderOutputPlatform["YouTubeShorts"] = "youtube-shorts";
    RenderOutputPlatform["YouTubeLongForm"] = "youtube-long-form";
    RenderOutputPlatform["WhatsApp"] = "whatsapp";
    RenderOutputPlatform["Website"] = "website";
    RenderOutputPlatform["Television"] = "television";
    RenderOutputPlatform["DigitalSignage"] = "digital-signage";
})(RenderOutputPlatform || (RenderOutputPlatform = {}));
export class RenderingPreparationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "RenderingPreparationEngineError";
    }
}
export const RENDER_OUTPUT_PLATFORM_TARGETS = [
    RenderOutputPlatform.TikTok,
    RenderOutputPlatform.InstagramReels,
    RenderOutputPlatform.Facebook,
    RenderOutputPlatform.YouTubeShorts,
    RenderOutputPlatform.YouTubeLongForm,
    RenderOutputPlatform.WhatsApp,
    RenderOutputPlatform.Website,
    RenderOutputPlatform.Television,
    RenderOutputPlatform.DigitalSignage,
];
export const OUTPUT_PROFILE_CONFIG = {
    [RenderOutputPlatform.TikTok]: { resolution: "1080x1920", aspectRatio: "9:16", frameRate: "30fps", codec: "H.264", bitrate: "8-12 Mbps" },
    [RenderOutputPlatform.InstagramReels]: { resolution: "1080x1920", aspectRatio: "9:16", frameRate: "30fps", codec: "H.264", bitrate: "10-15 Mbps" },
    [RenderOutputPlatform.Facebook]: { resolution: "1080x1080", aspectRatio: "1:1", frameRate: "30fps", codec: "H.264", bitrate: "8-10 Mbps" },
    [RenderOutputPlatform.YouTubeShorts]: { resolution: "1080x1920", aspectRatio: "9:16", frameRate: "30fps", codec: "H.264/H.265", bitrate: "12-18 Mbps" },
    [RenderOutputPlatform.YouTubeLongForm]: { resolution: "3840x2160", aspectRatio: "16:9", frameRate: "24/30fps", codec: "H.265", bitrate: "35-45 Mbps" },
    [RenderOutputPlatform.WhatsApp]: { resolution: "720x1280", aspectRatio: "9:16", frameRate: "30fps", codec: "H.264", bitrate: "4-6 Mbps" },
    [RenderOutputPlatform.Website]: { resolution: "1920x1080", aspectRatio: "16:9", frameRate: "30fps", codec: "H.264", bitrate: "10-20 Mbps" },
    [RenderOutputPlatform.Television]: { resolution: "3840x2160", aspectRatio: "16:9", frameRate: "25fps", codec: "ProRes 422 HQ", bitrate: "120 Mbps" },
    [RenderOutputPlatform.DigitalSignage]: { resolution: "3840x2160", aspectRatio: "16:9", frameRate: "60fps", codec: "H.265", bitrate: "25-40 Mbps" },
};
export function mapStoryboardToRenderOutput(platform) {
    const map = {
        [StoryboardGenerationPlatform.TikTok]: RenderOutputPlatform.TikTok,
        [StoryboardGenerationPlatform.InstagramReels]: RenderOutputPlatform.InstagramReels,
        [StoryboardGenerationPlatform.Facebook]: RenderOutputPlatform.Facebook,
        [StoryboardGenerationPlatform.YouTubeShorts]: RenderOutputPlatform.YouTubeShorts,
        [StoryboardGenerationPlatform.YouTubeLongForm]: RenderOutputPlatform.YouTubeLongForm,
        [StoryboardGenerationPlatform.WhatsApp]: RenderOutputPlatform.WhatsApp,
        [StoryboardGenerationPlatform.Website]: RenderOutputPlatform.Website,
        [StoryboardGenerationPlatform.Television]: RenderOutputPlatform.Television,
    };
    return map[platform] ?? RenderOutputPlatform.Website;
}
//# sourceMappingURL=types.js.map
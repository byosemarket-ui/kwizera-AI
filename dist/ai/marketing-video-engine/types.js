/**
 * KWIZERA AI STUDIO — Marketing Video Engine types (Step 8I)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export var MarketingVideoPlanType;
(function (MarketingVideoPlanType) {
    MarketingVideoPlanType["Conversion"] = "conversion";
    MarketingVideoPlanType["Awareness"] = "awareness";
    MarketingVideoPlanType["Engagement"] = "engagement";
    MarketingVideoPlanType["ProductLaunch"] = "product-launch";
    MarketingVideoPlanType["Combined"] = "combined";
})(MarketingVideoPlanType || (MarketingVideoPlanType = {}));
export class MarketingVideoEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MarketingVideoEngineError";
    }
}
export const MARKETING_VIDEO_PLATFORM_TARGETS = [
    StoryboardGenerationPlatform.TikTok,
    StoryboardGenerationPlatform.InstagramReels,
    StoryboardGenerationPlatform.Facebook,
    StoryboardGenerationPlatform.YouTubeShorts,
    StoryboardGenerationPlatform.YouTubeLongForm,
    StoryboardGenerationPlatform.WhatsApp,
    StoryboardGenerationPlatform.Website,
    StoryboardGenerationPlatform.Television,
];
export const PLATFORM_MARKETING_CONFIG = {
    [StoryboardGenerationPlatform.TikTok]: { hookStyle: "pattern-interrupt", ctaAdaptation: "swipe-up CTA overlay" },
    [StoryboardGenerationPlatform.InstagramReels]: { hookStyle: "visual-first", ctaAdaptation: "link-in-bio CTA card" },
    [StoryboardGenerationPlatform.Facebook]: { hookStyle: "problem-solution", ctaAdaptation: "learn-more button" },
    [StoryboardGenerationPlatform.YouTubeShorts]: { hookStyle: "rapid-hook", ctaAdaptation: "subscribe + link CTA" },
    [StoryboardGenerationPlatform.YouTubeLongForm]: { hookStyle: "story-hook", ctaAdaptation: "end-screen CTA cluster" },
    [StoryboardGenerationPlatform.WhatsApp]: { hookStyle: "direct-message", ctaAdaptation: "reply-to-order CTA" },
    [StoryboardGenerationPlatform.Website]: { hookStyle: "value-proposition", ctaAdaptation: "primary button CTA" },
    [StoryboardGenerationPlatform.Television]: { hookStyle: "brand-story", ctaAdaptation: "URL + tagline lockup" },
};
//# sourceMappingURL=types.js.map
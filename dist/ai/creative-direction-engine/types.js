/**
 * KWIZERA AI STUDIO — Creative Direction Engine types (Step 5F)
 */
export var CreativePlatform;
(function (CreativePlatform) {
    CreativePlatform["TikTok"] = "tiktok";
    CreativePlatform["InstagramReels"] = "instagram-reels";
    CreativePlatform["Facebook"] = "facebook";
    CreativePlatform["YouTubeShorts"] = "youtube-shorts";
    CreativePlatform["YouTube"] = "youtube";
    CreativePlatform["WhatsAppStatus"] = "whatsapp-status";
    CreativePlatform["Website"] = "website";
})(CreativePlatform || (CreativePlatform = {}));
export var CreativeDirectionStyle;
(function (CreativeDirectionStyle) {
    CreativeDirectionStyle["Emotional"] = "emotional";
    CreativeDirectionStyle["Educational"] = "educational";
    CreativeDirectionStyle["Promotional"] = "promotional";
    CreativeDirectionStyle["Storytelling"] = "storytelling";
    CreativeDirectionStyle["Demonstration"] = "demonstration";
    CreativeDirectionStyle["Luxury"] = "luxury";
    CreativeDirectionStyle["Lifestyle"] = "lifestyle";
    CreativeDirectionStyle["SocialProof"] = "social-proof";
    CreativeDirectionStyle["ValueBased"] = "value-based";
    CreativeDirectionStyle["ProblemSolution"] = "problem-solution";
    CreativeDirectionStyle["ModernMinimal"] = "modern-minimal";
    CreativeDirectionStyle["PremiumVisual"] = "premium-visual";
})(CreativeDirectionStyle || (CreativeDirectionStyle = {}));
export class CreativeDirectionEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "CreativeDirectionEngineError";
    }
}
//# sourceMappingURL=types.js.map
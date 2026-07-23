/**
 * KWIZERA AI STUDIO — Storyboard Generation Engine types (Step 8B)
 */
export var StoryboardGenerationPlatform;
(function (StoryboardGenerationPlatform) {
    StoryboardGenerationPlatform["TikTok"] = "tiktok";
    StoryboardGenerationPlatform["InstagramReels"] = "instagram-reels";
    StoryboardGenerationPlatform["Facebook"] = "facebook";
    StoryboardGenerationPlatform["YouTubeShorts"] = "youtube-shorts";
    StoryboardGenerationPlatform["YouTubeLongForm"] = "youtube-long-form";
    StoryboardGenerationPlatform["WhatsApp"] = "whatsapp";
    StoryboardGenerationPlatform["Website"] = "website";
    StoryboardGenerationPlatform["Television"] = "television";
})(StoryboardGenerationPlatform || (StoryboardGenerationPlatform = {}));
export var StoryboardGenerationInputType;
(function (StoryboardGenerationInputType) {
    StoryboardGenerationInputType["TextPrompt"] = "text-prompt";
    StoryboardGenerationInputType["ProductInformation"] = "product-information";
    StoryboardGenerationInputType["BrandGuidelines"] = "brand-guidelines";
    StoryboardGenerationInputType["MarketingCampaign"] = "marketing-campaign";
    StoryboardGenerationInputType["CreativeBrief"] = "creative-brief";
    StoryboardGenerationInputType["Script"] = "script";
    StoryboardGenerationInputType["Image"] = "image";
    StoryboardGenerationInputType["Video"] = "video";
    StoryboardGenerationInputType["VoiceInstructions"] = "voice-instructions";
    StoryboardGenerationInputType["KnowledgeRecord"] = "knowledge-record";
})(StoryboardGenerationInputType || (StoryboardGenerationInputType = {}));
export var StoryboardStoryType;
(function (StoryboardStoryType) {
    StoryboardStoryType["ProductLaunch"] = "product-launch";
    StoryboardStoryType["BrandAwareness"] = "brand-awareness";
    StoryboardStoryType["Conversion"] = "conversion";
    StoryboardStoryType["Educational"] = "educational";
    StoryboardStoryType["Testimonial"] = "testimonial";
    StoryboardStoryType["Promotional"] = "promotional";
    StoryboardStoryType["Custom"] = "custom";
})(StoryboardStoryType || (StoryboardStoryType = {}));
export var ShotType;
(function (ShotType) {
    ShotType["Wide"] = "wide";
    ShotType["Medium"] = "medium";
    ShotType["CloseUp"] = "close-up";
    ShotType["ExtremeCloseUp"] = "extreme-close-up";
    ShotType["OverTheShoulder"] = "over-the-shoulder";
    ShotType["Aerial"] = "aerial";
    ShotType["POV"] = "pov";
    ShotType["Insert"] = "insert";
})(ShotType || (ShotType = {}));
export var CameraAngle;
(function (CameraAngle) {
    CameraAngle["EyeLevel"] = "eye-level";
    CameraAngle["LowAngle"] = "low-angle";
    CameraAngle["HighAngle"] = "high-angle";
    CameraAngle["Dutch"] = "dutch";
    CameraAngle["BirdEye"] = "bird-eye";
    CameraAngle["WormEye"] = "worm-eye";
})(CameraAngle || (CameraAngle = {}));
export var CameraMovement;
(function (CameraMovement) {
    CameraMovement["Static"] = "static";
    CameraMovement["Pan"] = "pan";
    CameraMovement["Tilt"] = "tilt";
    CameraMovement["Dolly"] = "dolly";
    CameraMovement["Tracking"] = "tracking";
    CameraMovement["Crane"] = "crane";
    CameraMovement["Handheld"] = "handheld";
    CameraMovement["Zoom"] = "zoom";
})(CameraMovement || (CameraMovement = {}));
export class StoryboardGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "StoryboardGenerationEngineError";
    }
}
/** Map CreativePlatform to StoryboardGenerationPlatform */
export function mapCreativePlatform(platform) {
    const map = {
        tiktok: StoryboardGenerationPlatform.TikTok,
        "instagram-reels": StoryboardGenerationPlatform.InstagramReels,
        facebook: StoryboardGenerationPlatform.Facebook,
        "youtube-shorts": StoryboardGenerationPlatform.YouTubeShorts,
        youtube: StoryboardGenerationPlatform.YouTubeLongForm,
        "whatsapp-status": StoryboardGenerationPlatform.WhatsApp,
        website: StoryboardGenerationPlatform.Website,
    };
    return map[platform] ?? StoryboardGenerationPlatform.Website;
}
export const ALL_STORYBOARD_PLATFORMS = [
    StoryboardGenerationPlatform.TikTok,
    StoryboardGenerationPlatform.InstagramReels,
    StoryboardGenerationPlatform.Facebook,
    StoryboardGenerationPlatform.YouTubeShorts,
    StoryboardGenerationPlatform.YouTubeLongForm,
    StoryboardGenerationPlatform.WhatsApp,
    StoryboardGenerationPlatform.Website,
    StoryboardGenerationPlatform.Television,
];
export const PLATFORM_CONFIG = {
    [StoryboardGenerationPlatform.TikTok]: { sceneCount: 6, totalSeconds: 45, aspectRatio: "9:16" },
    [StoryboardGenerationPlatform.InstagramReels]: { sceneCount: 7, totalSeconds: 60, aspectRatio: "9:16" },
    [StoryboardGenerationPlatform.Facebook]: { sceneCount: 8, totalSeconds: 90, aspectRatio: "1:1" },
    [StoryboardGenerationPlatform.YouTubeShorts]: { sceneCount: 6, totalSeconds: 50, aspectRatio: "9:16" },
    [StoryboardGenerationPlatform.YouTubeLongForm]: { sceneCount: 10, totalSeconds: 180, aspectRatio: "16:9" },
    [StoryboardGenerationPlatform.WhatsApp]: { sceneCount: 5, totalSeconds: 45, aspectRatio: "9:16" },
    [StoryboardGenerationPlatform.Website]: { sceneCount: 8, totalSeconds: 90, aspectRatio: "16:9" },
    [StoryboardGenerationPlatform.Television]: { sceneCount: 12, totalSeconds: 30, aspectRatio: "16:9" },
};
//# sourceMappingURL=types.js.map
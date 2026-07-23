/**
 * KWIZERA AI STUDIO — Music Generation Engine types (Step 10E)
 */
export var MusicPlatform;
(function (MusicPlatform) {
    MusicPlatform["Website"] = "website";
    MusicPlatform["Mobile"] = "mobile";
    MusicPlatform["YouTube"] = "youtube";
    MusicPlatform["TikTok"] = "tiktok";
    MusicPlatform["Instagram"] = "instagram";
    MusicPlatform["Facebook"] = "facebook";
    MusicPlatform["Television"] = "television";
    MusicPlatform["Radio"] = "radio";
})(MusicPlatform || (MusicPlatform = {}));
export var MusicGenre;
(function (MusicGenre) {
    MusicGenre["Cinematic"] = "cinematic";
    MusicGenre["Corporate"] = "corporate";
    MusicGenre["Commercial"] = "commercial";
    MusicGenre["Pop"] = "pop";
    MusicGenre["Rock"] = "rock";
    MusicGenre["HipHop"] = "hip-hop";
    MusicGenre["Jazz"] = "jazz";
    MusicGenre["Classical"] = "classical";
    MusicGenre["Gospel"] = "gospel";
    MusicGenre["Afrobeat"] = "afrobeat";
    MusicGenre["EDM"] = "edm";
    MusicGenre["Ambient"] = "ambient";
    MusicGenre["LoFi"] = "lo-fi";
    MusicGenre["Orchestral"] = "orchestral";
})(MusicGenre || (MusicGenre = {}));
export var MusicMood;
(function (MusicMood) {
    MusicMood["Happy"] = "happy";
    MusicMood["Calm"] = "calm";
    MusicMood["Emotional"] = "emotional";
    MusicMood["Inspirational"] = "inspirational";
    MusicMood["Epic"] = "epic";
    MusicMood["Romantic"] = "romantic";
    MusicMood["Serious"] = "serious";
    MusicMood["Dramatic"] = "dramatic";
    MusicMood["Energetic"] = "energetic";
    MusicMood["Relaxing"] = "relaxing";
})(MusicMood || (MusicMood = {}));
export var MusicInputType;
(function (MusicInputType) {
    MusicInputType["MusicPrompt"] = "music-prompt";
    MusicInputType["VideoInformation"] = "video-information";
    MusicInputType["ImageInformation"] = "image-information";
    MusicInputType["BrandGuidelines"] = "brand-guidelines";
    MusicInputType["Campaign"] = "campaign";
    MusicInputType["KnowledgeRecord"] = "knowledge-record";
})(MusicInputType || (MusicInputType = {}));
export var SyncTarget;
(function (SyncTarget) {
    SyncTarget["Video"] = "video";
    SyncTarget["Animation"] = "animation";
    SyncTarget["Advertisement"] = "advertisement";
    SyncTarget["Podcast"] = "podcast";
    SyncTarget["Presentation"] = "presentation";
    SyncTarget["SocialMedia"] = "social-media";
    SyncTarget["Game"] = "game";
    SyncTarget["Film"] = "film";
})(SyncTarget || (SyncTarget = {}));
export var LoopType;
(function (LoopType) {
    LoopType["Seamless"] = "seamless";
    LoopType["Intro"] = "intro";
    LoopType["Ambient"] = "ambient";
    LoopType["Background"] = "background";
    LoopType["Ending"] = "ending";
})(LoopType || (LoopType = {}));
export class MusicGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MusicGenerationEngineError";
    }
}
export const ALL_MUSIC_PLATFORMS = [
    MusicPlatform.Website,
    MusicPlatform.Mobile,
    MusicPlatform.YouTube,
    MusicPlatform.TikTok,
    MusicPlatform.Instagram,
    MusicPlatform.Facebook,
    MusicPlatform.Television,
    MusicPlatform.Radio,
];
export const SUPPORTED_MUSIC_GENRES = [
    MusicGenre.Cinematic,
    MusicGenre.Corporate,
    MusicGenre.Commercial,
    MusicGenre.Pop,
    MusicGenre.Rock,
    MusicGenre.HipHop,
    MusicGenre.Jazz,
    MusicGenre.Classical,
    MusicGenre.Gospel,
    MusicGenre.Afrobeat,
    MusicGenre.EDM,
    MusicGenre.Ambient,
    MusicGenre.LoFi,
    MusicGenre.Orchestral,
];
export const SUPPORTED_MUSIC_MOODS = [
    MusicMood.Happy,
    MusicMood.Calm,
    MusicMood.Emotional,
    MusicMood.Inspirational,
    MusicMood.Epic,
    MusicMood.Romantic,
    MusicMood.Serious,
    MusicMood.Dramatic,
    MusicMood.Energetic,
    MusicMood.Relaxing,
];
export const PLATFORM_MUSIC_CONFIG = {
    [MusicPlatform.Website]: { maxDurationSec: 180, loudnessTarget: "-14 LUFS", formatNotes: "Background-friendly mix" },
    [MusicPlatform.Mobile]: { maxDurationSec: 120, loudnessTarget: "-14 LUFS", formatNotes: "Compressed for mobile playback" },
    [MusicPlatform.YouTube]: { maxDurationSec: 600, loudnessTarget: "-14 LUFS", formatNotes: "Full dynamic range for video" },
    [MusicPlatform.TikTok]: { maxDurationSec: 60, loudnessTarget: "-12 LUFS", formatNotes: "Hook-forward, punchy mix" },
    [MusicPlatform.Instagram]: { maxDurationSec: 90, loudnessTarget: "-13 LUFS", formatNotes: "Trend-aware arrangement" },
    [MusicPlatform.Facebook]: { maxDurationSec: 120, loudnessTarget: "-14 LUFS", formatNotes: "Auto-play optimized" },
    [MusicPlatform.Television]: { maxDurationSec: 30, loudnessTarget: "-24 LUFS", formatNotes: "Broadcast loudness standard" },
    [MusicPlatform.Radio]: { maxDurationSec: 180, loudnessTarget: "-16 LUFS", formatNotes: "Radio-ready mastering" },
};
//# sourceMappingURL=types.js.map
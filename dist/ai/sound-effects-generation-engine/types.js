/**
 * KWIZERA AI STUDIO — Sound Effects Generation Engine types (Step 10F)
 */
export var SfxPlatform;
(function (SfxPlatform) {
    SfxPlatform["Website"] = "website";
    SfxPlatform["Mobile"] = "mobile";
    SfxPlatform["YouTube"] = "youtube";
    SfxPlatform["TikTok"] = "tiktok";
    SfxPlatform["Instagram"] = "instagram";
    SfxPlatform["Facebook"] = "facebook";
    SfxPlatform["Television"] = "television";
    SfxPlatform["Radio"] = "radio";
})(SfxPlatform || (SfxPlatform = {}));
export var SoundCategory;
(function (SoundCategory) {
    SoundCategory["Foley"] = "foley";
    SoundCategory["Environmental"] = "environmental";
    SoundCategory["Cinematic"] = "cinematic";
    SoundCategory["Transition"] = "transition";
    SoundCategory["Interface"] = "interface";
    SoundCategory["Object"] = "object";
    SoundCategory["Human"] = "human";
    SoundCategory["Mechanical"] = "mechanical";
    SoundCategory["Electronic"] = "electronic";
    SoundCategory["Mixed"] = "mixed";
})(SoundCategory || (SoundCategory = {}));
export var SfxInputType;
(function (SfxInputType) {
    SfxInputType["SoundPrompt"] = "sound-prompt";
    SfxInputType["VideoInformation"] = "video-information";
    SfxInputType["ImageInformation"] = "image-information";
    SfxInputType["AnimationInformation"] = "animation-information";
    SfxInputType["BrandGuidelines"] = "brand-guidelines";
    SfxInputType["Campaign"] = "campaign";
    SfxInputType["Timeline"] = "timeline";
    SfxInputType["KnowledgeRecord"] = "knowledge-record";
})(SfxInputType || (SfxInputType = {}));
export var SfxSyncTarget;
(function (SfxSyncTarget) {
    SfxSyncTarget["Video"] = "video";
    SfxSyncTarget["Animation"] = "animation";
    SfxSyncTarget["Game"] = "game";
    SfxSyncTarget["Film"] = "film";
    SfxSyncTarget["Podcast"] = "podcast";
    SfxSyncTarget["Advertisement"] = "advertisement";
    SfxSyncTarget["SocialMedia"] = "social-media";
})(SfxSyncTarget || (SfxSyncTarget = {}));
export var FoleyType;
(function (FoleyType) {
    FoleyType["Footsteps"] = "footsteps";
    FoleyType["ClothingMovement"] = "clothing-movement";
    FoleyType["DoorSounds"] = "door-sounds";
    FoleyType["GlassSounds"] = "glass-sounds";
    FoleyType["MetalSounds"] = "metal-sounds";
    FoleyType["PaperSounds"] = "paper-sounds";
    FoleyType["WaterSounds"] = "water-sounds";
    FoleyType["ToolSounds"] = "tool-sounds";
})(FoleyType || (FoleyType = {}));
export var EnvironmentalType;
(function (EnvironmentalType) {
    EnvironmentalType["Rain"] = "rain";
    EnvironmentalType["Wind"] = "wind";
    EnvironmentalType["Forest"] = "forest";
    EnvironmentalType["Ocean"] = "ocean";
    EnvironmentalType["River"] = "river";
    EnvironmentalType["Fire"] = "fire";
    EnvironmentalType["Crowd"] = "crowd";
    EnvironmentalType["Office"] = "office";
    EnvironmentalType["Restaurant"] = "restaurant";
    EnvironmentalType["City"] = "city";
    EnvironmentalType["Village"] = "village";
    EnvironmentalType["Market"] = "market";
})(EnvironmentalType || (EnvironmentalType = {}));
export var CinematicType;
(function (CinematicType) {
    CinematicType["Impact"] = "impact";
    CinematicType["Boom"] = "boom";
    CinematicType["Whoosh"] = "whoosh";
    CinematicType["Rise"] = "rise";
    CinematicType["Hit"] = "hit";
    CinematicType["TrailerEffects"] = "trailer-effects";
    CinematicType["TransitionEffects"] = "transition-effects";
    CinematicType["Atmosphere"] = "atmosphere";
})(CinematicType || (CinematicType = {}));
export class SoundEffectsGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "SoundEffectsGenerationEngineError";
    }
}
export const ALL_SFX_PLATFORMS = [
    SfxPlatform.Website,
    SfxPlatform.Mobile,
    SfxPlatform.YouTube,
    SfxPlatform.TikTok,
    SfxPlatform.Instagram,
    SfxPlatform.Facebook,
    SfxPlatform.Television,
    SfxPlatform.Radio,
];
export const SUPPORTED_SOUND_CATEGORIES = [
    SoundCategory.Foley,
    SoundCategory.Environmental,
    SoundCategory.Cinematic,
    SoundCategory.Transition,
    SoundCategory.Interface,
    SoundCategory.Object,
    SoundCategory.Human,
    SoundCategory.Mechanical,
    SoundCategory.Electronic,
    SoundCategory.Mixed,
];
export const FOLEY_TYPES = Object.values(FoleyType);
export const ENVIRONMENTAL_TYPES = Object.values(EnvironmentalType);
export const CINEMATIC_TYPES = Object.values(CinematicType);
export const PLATFORM_SFX_CONFIG = {
    [SfxPlatform.Website]: { maxDurationSec: 30, loudnessTarget: "-16 LUFS", formatNotes: "Subtle UI and transition SFX" },
    [SfxPlatform.Mobile]: { maxDurationSec: 15, loudnessTarget: "-14 LUFS", formatNotes: "Short tactile feedback sounds" },
    [SfxPlatform.YouTube]: { maxDurationSec: 120, loudnessTarget: "-14 LUFS", formatNotes: "Full cinematic SFX range" },
    [SfxPlatform.TikTok]: { maxDurationSec: 15, loudnessTarget: "-12 LUFS", formatNotes: "Punchy impact and whoosh" },
    [SfxPlatform.Instagram]: { maxDurationSec: 20, loudnessTarget: "-13 LUFS", formatNotes: "Trend-aware transition SFX" },
    [SfxPlatform.Facebook]: { maxDurationSec: 30, loudnessTarget: "-14 LUFS", formatNotes: "Auto-play optimized SFX" },
    [SfxPlatform.Television]: { maxDurationSec: 10, loudnessTarget: "-24 LUFS", formatNotes: "Broadcast SFX standard" },
    [SfxPlatform.Radio]: { maxDurationSec: 5, loudnessTarget: "-16 LUFS", formatNotes: "Stinger and transition SFX" },
};
//# sourceMappingURL=types.js.map
/**
 * KWIZERA AI STUDIO — Voice Cloning Generation Engine types (Step 10D)
 */
export var VcPlatform;
(function (VcPlatform) {
    VcPlatform["Website"] = "website";
    VcPlatform["MobileApp"] = "mobile-app";
    VcPlatform["YouTube"] = "youtube";
    VcPlatform["TikTok"] = "tiktok";
    VcPlatform["Instagram"] = "instagram";
    VcPlatform["Facebook"] = "facebook";
    VcPlatform["Television"] = "television";
})(VcPlatform || (VcPlatform = {}));
export var VcLanguage;
(function (VcLanguage) {
    VcLanguage["English"] = "en";
    VcLanguage["Kinyarwanda"] = "rw";
    VcLanguage["French"] = "fr";
    VcLanguage["Swahili"] = "sw";
})(VcLanguage || (VcLanguage = {}));
export var VcInputType;
(function (VcInputType) {
    VcInputType["VoiceSample"] = "voice-sample";
    VcInputType["VoiceConsent"] = "voice-consent";
    VcInputType["VoiceMetadata"] = "voice-metadata";
    VcInputType["BrandGuidelines"] = "brand-guidelines";
    VcInputType["Campaign"] = "campaign";
    VcInputType["KnowledgeRecord"] = "knowledge-record";
})(VcInputType || (VcInputType = {}));
export var VcOutputUseCase;
(function (VcOutputUseCase) {
    VcOutputUseCase["VideoNarration"] = "video-narration";
    VcOutputUseCase["Audiobook"] = "audiobook";
    VcOutputUseCase["Podcast"] = "podcast";
    VcOutputUseCase["Advertisement"] = "advertisement";
    VcOutputUseCase["CustomerSupport"] = "customer-support";
    VcOutputUseCase["Elearning"] = "e-learning";
    VcOutputUseCase["Accessibility"] = "accessibility";
})(VcOutputUseCase || (VcOutputUseCase = {}));
export var VoiceLibraryType;
(function (VoiceLibraryType) {
    VoiceLibraryType["Professional"] = "professional";
    VoiceLibraryType["Narrator"] = "narrator";
    VoiceLibraryType["Character"] = "character";
    VoiceLibraryType["Corporate"] = "corporate";
    VoiceLibraryType["Educational"] = "educational";
    VoiceLibraryType["Commercial"] = "commercial";
    VoiceLibraryType["CustomAuthorized"] = "custom-authorized";
})(VoiceLibraryType || (VoiceLibraryType = {}));
export var AuthorizationStatus;
(function (AuthorizationStatus) {
    AuthorizationStatus["Authorized"] = "authorized";
    AuthorizationStatus["Pending"] = "pending";
    AuthorizationStatus["Expired"] = "expired";
    AuthorizationStatus["Revoked"] = "revoked";
    AuthorizationStatus["Unauthorized"] = "unauthorized";
})(AuthorizationStatus || (AuthorizationStatus = {}));
export class VoiceCloningGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VoiceCloningGenerationEngineError";
    }
}
export const ALL_VC_PLATFORMS = [
    VcPlatform.Website,
    VcPlatform.MobileApp,
    VcPlatform.YouTube,
    VcPlatform.TikTok,
    VcPlatform.Instagram,
    VcPlatform.Facebook,
    VcPlatform.Television,
];
export const SUPPORTED_VC_LANGUAGES = [
    VcLanguage.English,
    VcLanguage.Kinyarwanda,
    VcLanguage.French,
    VcLanguage.Swahili,
];
export const VOICE_LIBRARY_TYPES = [
    VoiceLibraryType.Professional,
    VoiceLibraryType.Narrator,
    VoiceLibraryType.Character,
    VoiceLibraryType.Corporate,
    VoiceLibraryType.Educational,
    VoiceLibraryType.Commercial,
    VoiceLibraryType.CustomAuthorized,
];
export const PLATFORM_VC_CONFIG = {
    [VcPlatform.Website]: { speakingRate: "150 wpm", pauseProfile: "moderate", maxDurationSec: 120 },
    [VcPlatform.MobileApp]: { speakingRate: "145 wpm", pauseProfile: "short", maxDurationSec: 60 },
    [VcPlatform.YouTube]: { speakingRate: "155 wpm", pauseProfile: "narrative", maxDurationSec: 600 },
    [VcPlatform.TikTok]: { speakingRate: "165 wpm", pauseProfile: "minimal", maxDurationSec: 60 },
    [VcPlatform.Instagram]: { speakingRate: "160 wpm", pauseProfile: "conversational", maxDurationSec: 90 },
    [VcPlatform.Facebook]: { speakingRate: "150 wpm", pauseProfile: "moderate", maxDurationSec: 120 },
    [VcPlatform.Television]: { speakingRate: "140 wpm", pauseProfile: "broadcast", maxDurationSec: 30 },
};
//# sourceMappingURL=types.js.map
/**
 * KWIZERA AI STUDIO — Speech-to-Speech Generation Engine types (Step 10C)
 */
export var S2sPlatform;
(function (S2sPlatform) {
    S2sPlatform["Website"] = "website";
    S2sPlatform["MobileApp"] = "mobile-app";
    S2sPlatform["YouTube"] = "youtube";
    S2sPlatform["TikTok"] = "tiktok";
    S2sPlatform["Instagram"] = "instagram";
    S2sPlatform["Facebook"] = "facebook";
    S2sPlatform["Television"] = "television";
})(S2sPlatform || (S2sPlatform = {}));
export var S2sLanguage;
(function (S2sLanguage) {
    S2sLanguage["English"] = "en";
    S2sLanguage["Kinyarwanda"] = "rw";
    S2sLanguage["French"] = "fr";
    S2sLanguage["Swahili"] = "sw";
})(S2sLanguage || (S2sLanguage = {}));
export var S2sInputType;
(function (S2sInputType) {
    S2sInputType["SourceAudio"] = "source-audio";
    S2sInputType["VoiceProfile"] = "voice-profile";
    S2sInputType["BrandGuidelines"] = "brand-guidelines";
    S2sInputType["Campaign"] = "campaign";
    S2sInputType["StyleReference"] = "style-reference";
    S2sInputType["KnowledgeRecord"] = "knowledge-record";
})(S2sInputType || (S2sInputType = {}));
export var S2sOutputUseCase;
(function (S2sOutputUseCase) {
    S2sOutputUseCase["VideoNarration"] = "video-narration";
    S2sOutputUseCase["Audiobook"] = "audiobook";
    S2sOutputUseCase["Podcast"] = "podcast";
    S2sOutputUseCase["Advertisement"] = "advertisement";
    S2sOutputUseCase["CustomerSupport"] = "customer-support";
    S2sOutputUseCase["Elearning"] = "e-learning";
    S2sOutputUseCase["Accessibility"] = "accessibility";
})(S2sOutputUseCase || (S2sOutputUseCase = {}));
export var AccentType;
(function (AccentType) {
    AccentType["American"] = "american";
    AccentType["British"] = "british";
    AccentType["African"] = "african";
    AccentType["French"] = "french";
    AccentType["Neutral"] = "neutral";
    AccentType["Regional"] = "regional";
})(AccentType || (AccentType = {}));
export class SpeechToSpeechGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "SpeechToSpeechGenerationEngineError";
    }
}
export const ALL_S2S_PLATFORMS = [
    S2sPlatform.Website,
    S2sPlatform.MobileApp,
    S2sPlatform.YouTube,
    S2sPlatform.TikTok,
    S2sPlatform.Instagram,
    S2sPlatform.Facebook,
    S2sPlatform.Television,
];
export const SUPPORTED_S2S_LANGUAGES = [
    S2sLanguage.English,
    S2sLanguage.Kinyarwanda,
    S2sLanguage.French,
    S2sLanguage.Swahili,
];
export const PLATFORM_S2S_CONFIG = {
    [S2sPlatform.Website]: { speakingRate: "150 wpm", pauseProfile: "moderate", maxDurationSec: 120 },
    [S2sPlatform.MobileApp]: { speakingRate: "145 wpm", pauseProfile: "short", maxDurationSec: 60 },
    [S2sPlatform.YouTube]: { speakingRate: "155 wpm", pauseProfile: "narrative", maxDurationSec: 600 },
    [S2sPlatform.TikTok]: { speakingRate: "165 wpm", pauseProfile: "minimal", maxDurationSec: 60 },
    [S2sPlatform.Instagram]: { speakingRate: "160 wpm", pauseProfile: "conversational", maxDurationSec: 90 },
    [S2sPlatform.Facebook]: { speakingRate: "150 wpm", pauseProfile: "moderate", maxDurationSec: 120 },
    [S2sPlatform.Television]: { speakingRate: "140 wpm", pauseProfile: "broadcast", maxDurationSec: 30 },
};
//# sourceMappingURL=types.js.map
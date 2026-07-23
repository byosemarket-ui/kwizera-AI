/**
 * KWIZERA AI STUDIO — Text-to-Speech Generation Engine types (Step 10B)
 */
export var TtsPlatform;
(function (TtsPlatform) {
    TtsPlatform["Website"] = "website";
    TtsPlatform["MobileApp"] = "mobile-app";
    TtsPlatform["YouTube"] = "youtube";
    TtsPlatform["TikTok"] = "tiktok";
    TtsPlatform["Instagram"] = "instagram";
    TtsPlatform["Facebook"] = "facebook";
    TtsPlatform["Television"] = "television";
})(TtsPlatform || (TtsPlatform = {}));
export var TtsLanguage;
(function (TtsLanguage) {
    TtsLanguage["English"] = "en";
    TtsLanguage["Kinyarwanda"] = "rw";
    TtsLanguage["French"] = "fr";
    TtsLanguage["Swahili"] = "sw";
})(TtsLanguage || (TtsLanguage = {}));
export var TtsInputType;
(function (TtsInputType) {
    TtsInputType["Text"] = "text";
    TtsInputType["Script"] = "script";
    TtsInputType["SubtitleFile"] = "subtitle-file";
    TtsInputType["ProductInformation"] = "product-information";
    TtsInputType["BrandGuidelines"] = "brand-guidelines";
    TtsInputType["Campaign"] = "campaign";
    TtsInputType["KnowledgeRecord"] = "knowledge-record";
})(TtsInputType || (TtsInputType = {}));
export var TtsOutputUseCase;
(function (TtsOutputUseCase) {
    TtsOutputUseCase["VideoNarration"] = "video-narration";
    TtsOutputUseCase["Audiobook"] = "audiobook";
    TtsOutputUseCase["Podcast"] = "podcast";
    TtsOutputUseCase["Advertisement"] = "advertisement";
    TtsOutputUseCase["Presentation"] = "presentation";
    TtsOutputUseCase["Elearning"] = "e-learning";
    TtsOutputUseCase["CustomerSupport"] = "customer-support";
    TtsOutputUseCase["Accessibility"] = "accessibility";
})(TtsOutputUseCase || (TtsOutputUseCase = {}));
export var VoiceType;
(function (VoiceType) {
    VoiceType["Male"] = "male";
    VoiceType["Female"] = "female";
    VoiceType["Child"] = "child";
    VoiceType["Elder"] = "elder";
    VoiceType["Neutral"] = "neutral";
    VoiceType["Professional"] = "professional";
    VoiceType["Narrator"] = "narrator";
    VoiceType["Character"] = "character";
})(VoiceType || (VoiceType = {}));
export var EmotionType;
(function (EmotionType) {
    EmotionType["Neutral"] = "neutral";
    EmotionType["Happy"] = "happy";
    EmotionType["Excited"] = "excited";
    EmotionType["Calm"] = "calm";
    EmotionType["Serious"] = "serious";
    EmotionType["Sad"] = "sad";
    EmotionType["Friendly"] = "friendly";
    EmotionType["Professional"] = "professional";
    EmotionType["Inspirational"] = "inspirational";
    EmotionType["Urgent"] = "urgent";
})(EmotionType || (EmotionType = {}));
export class TextToSpeechGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "TextToSpeechGenerationEngineError";
    }
}
export const ALL_TTS_PLATFORMS = [
    TtsPlatform.Website,
    TtsPlatform.MobileApp,
    TtsPlatform.YouTube,
    TtsPlatform.TikTok,
    TtsPlatform.Instagram,
    TtsPlatform.Facebook,
    TtsPlatform.Television,
];
export const SUPPORTED_TTS_LANGUAGES = [
    TtsLanguage.English,
    TtsLanguage.Kinyarwanda,
    TtsLanguage.French,
    TtsLanguage.Swahili,
];
export const PLATFORM_SPEECH_CONFIG = {
    [TtsPlatform.Website]: { speakingRate: "150 wpm", pauseProfile: "moderate", maxDurationSec: 120 },
    [TtsPlatform.MobileApp]: { speakingRate: "145 wpm", pauseProfile: "short", maxDurationSec: 60 },
    [TtsPlatform.YouTube]: { speakingRate: "155 wpm", pauseProfile: "narrative", maxDurationSec: 600 },
    [TtsPlatform.TikTok]: { speakingRate: "165 wpm", pauseProfile: "minimal", maxDurationSec: 60 },
    [TtsPlatform.Instagram]: { speakingRate: "160 wpm", pauseProfile: "conversational", maxDurationSec: 90 },
    [TtsPlatform.Facebook]: { speakingRate: "150 wpm", pauseProfile: "moderate", maxDurationSec: 120 },
    [TtsPlatform.Television]: { speakingRate: "140 wpm", pauseProfile: "broadcast", maxDurationSec: 30 },
};
//# sourceMappingURL=types.js.map
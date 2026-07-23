/**
 * KWIZERA AI STUDIO — Audio Enhancement & Restoration Engine types (Step 10H)
 */
export var AudioEnhancementPlatform;
(function (AudioEnhancementPlatform) {
    AudioEnhancementPlatform["Website"] = "website";
    AudioEnhancementPlatform["Mobile"] = "mobile";
    AudioEnhancementPlatform["Podcast"] = "podcast";
    AudioEnhancementPlatform["Audiobook"] = "audiobook";
    AudioEnhancementPlatform["YouTube"] = "youtube";
    AudioEnhancementPlatform["TikTok"] = "tiktok";
    AudioEnhancementPlatform["Instagram"] = "instagram";
    AudioEnhancementPlatform["Television"] = "television";
    AudioEnhancementPlatform["Radio"] = "radio";
})(AudioEnhancementPlatform || (AudioEnhancementPlatform = {}));
export var AudioEnhancementType;
(function (AudioEnhancementType) {
    AudioEnhancementType["Voice"] = "voice";
    AudioEnhancementType["Music"] = "music";
    AudioEnhancementType["SoundEffects"] = "sound-effects";
    AudioEnhancementType["Ambient"] = "ambient";
    AudioEnhancementType["VideoAudio"] = "video-audio";
    AudioEnhancementType["Mixed"] = "mixed";
})(AudioEnhancementType || (AudioEnhancementType = {}));
export var AudioInputCategory;
(function (AudioInputCategory) {
    AudioInputCategory["VoiceAudio"] = "voice-audio";
    AudioInputCategory["MusicAudio"] = "music-audio";
    AudioInputCategory["SoundEffects"] = "sound-effects";
    AudioInputCategory["AmbientAudio"] = "ambient-audio";
    AudioInputCategory["VideoAudio"] = "video-audio";
})(AudioInputCategory || (AudioInputCategory = {}));
export var EnhancementTechnique;
(function (EnhancementTechnique) {
    EnhancementTechnique["NoiseReduction"] = "noise-reduction";
    EnhancementTechnique["VoiceEnhancement"] = "voice-enhancement";
    EnhancementTechnique["MusicEnhancement"] = "music-enhancement";
    EnhancementTechnique["BassEnhancement"] = "bass-enhancement";
    EnhancementTechnique["TrebleEnhancement"] = "treble-enhancement";
    EnhancementTechnique["StereoEnhancement"] = "stereo-enhancement";
    EnhancementTechnique["DynamicRangeOptimization"] = "dynamic-range-optimization";
    EnhancementTechnique["LoudnessNormalization"] = "loudness-normalization";
})(EnhancementTechnique || (EnhancementTechnique = {}));
export var RestorationTechnique;
(function (RestorationTechnique) {
    RestorationTechnique["ClickRemoval"] = "click-removal";
    RestorationTechnique["PopRemoval"] = "pop-removal";
    RestorationTechnique["HumRemoval"] = "hum-removal";
    RestorationTechnique["HissRemoval"] = "hiss-removal";
    RestorationTechnique["EchoReduction"] = "echo-reduction";
    RestorationTechnique["DistortionReduction"] = "distortion-reduction";
    RestorationTechnique["ClippingRecovery"] = "clipping-recovery";
    RestorationTechnique["MissingAudioReconstruction"] = "missing-audio-reconstruction";
    RestorationTechnique["OldRecordingRestoration"] = "old-recording-restoration";
})(RestorationTechnique || (RestorationTechnique = {}));
export var EnhancementInputType;
(function (EnhancementInputType) {
    EnhancementInputType["VoiceAudio"] = "voice-audio";
    EnhancementInputType["MusicAudio"] = "music-audio";
    EnhancementInputType["SoundEffects"] = "sound-effects";
    EnhancementInputType["AmbientAudio"] = "ambient-audio";
    EnhancementInputType["VideoAudio"] = "video-audio";
    EnhancementInputType["AudioMetadata"] = "audio-metadata";
    EnhancementInputType["BrandGuidelines"] = "brand-guidelines";
    EnhancementInputType["KnowledgeRecord"] = "knowledge-record";
})(EnhancementInputType || (EnhancementInputType = {}));
export class AudioEnhancementRestorationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AudioEnhancementRestorationEngineError";
    }
}
export const ALL_ENHANCEMENT_PLATFORMS = [
    AudioEnhancementPlatform.Website,
    AudioEnhancementPlatform.Mobile,
    AudioEnhancementPlatform.Podcast,
    AudioEnhancementPlatform.Audiobook,
    AudioEnhancementPlatform.YouTube,
    AudioEnhancementPlatform.TikTok,
    AudioEnhancementPlatform.Instagram,
    AudioEnhancementPlatform.Television,
    AudioEnhancementPlatform.Radio,
];
export const ENHANCEMENT_TECHNIQUES = Object.values(EnhancementTechnique);
export const RESTORATION_TECHNIQUES = Object.values(RestorationTechnique);
export const PLATFORM_ENHANCEMENT_CONFIG = {
    [AudioEnhancementPlatform.Website]: { targetLufs: -16, formatNotes: "Web-optimized stereo AAC", deliveryPriority: "clarity" },
    [AudioEnhancementPlatform.Mobile]: { targetLufs: -16, formatNotes: "Mobile-friendly compressed stereo", deliveryPriority: "clarity" },
    [AudioEnhancementPlatform.Podcast]: { targetLufs: -16, formatNotes: "Podcast loudness standard -16 LUFS", deliveryPriority: "voice-clarity" },
    [AudioEnhancementPlatform.Audiobook]: { targetLufs: -18, formatNotes: "Audiobook narration clarity", deliveryPriority: "voice-clarity" },
    [AudioEnhancementPlatform.YouTube]: { targetLufs: -14, formatNotes: "YouTube loudness normalization", deliveryPriority: "balanced" },
    [AudioEnhancementPlatform.TikTok]: { targetLufs: -14, formatNotes: "Short-form mobile delivery", deliveryPriority: "impact" },
    [AudioEnhancementPlatform.Instagram]: { targetLufs: -14, formatNotes: "Social media stereo delivery", deliveryPriority: "impact" },
    [AudioEnhancementPlatform.Television]: { targetLufs: -24, formatNotes: "EBU R128 broadcast standard", deliveryPriority: "dynamic-range" },
    [AudioEnhancementPlatform.Radio]: { targetLufs: -23, formatNotes: "Radio broadcast loudness", deliveryPriority: "consistency" },
};
//# sourceMappingURL=types.js.map
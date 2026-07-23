/**
 * KWIZERA AI STUDIO — Audio Production Engine types (Step 10J)
 */
export var AudioProductionPlatform;
(function (AudioProductionPlatform) {
    AudioProductionPlatform["Website"] = "website";
    AudioProductionPlatform["Mobile"] = "mobile";
    AudioProductionPlatform["Podcast"] = "podcast";
    AudioProductionPlatform["Audiobook"] = "audiobook";
    AudioProductionPlatform["YouTube"] = "youtube";
    AudioProductionPlatform["TikTok"] = "tiktok";
    AudioProductionPlatform["Instagram"] = "instagram";
    AudioProductionPlatform["Television"] = "television";
    AudioProductionPlatform["Radio"] = "radio";
    AudioProductionPlatform["Film"] = "film";
})(AudioProductionPlatform || (AudioProductionPlatform = {}));
export var AudioProductionWorkflowStage;
(function (AudioProductionWorkflowStage) {
    AudioProductionWorkflowStage["TextToSpeech"] = "text-to-speech";
    AudioProductionWorkflowStage["SpeechToSpeech"] = "speech-to-speech";
    AudioProductionWorkflowStage["VoiceCloning"] = "voice-cloning";
    AudioProductionWorkflowStage["MusicGeneration"] = "music-generation";
    AudioProductionWorkflowStage["SoundEffectsGeneration"] = "sound-effects-generation";
    AudioProductionWorkflowStage["AmbientAudioGeneration"] = "ambient-audio-generation";
    AudioProductionWorkflowStage["AudioEnhancement"] = "audio-enhancement";
    AudioProductionWorkflowStage["AudioRestoration"] = "audio-restoration";
    AudioProductionWorkflowStage["AudioMixing"] = "audio-mixing";
    AudioProductionWorkflowStage["AudioMastering"] = "audio-mastering";
    AudioProductionWorkflowStage["ProductionWorkflow"] = "production-workflow";
})(AudioProductionWorkflowStage || (AudioProductionWorkflowStage = {}));
export var AudioProductionAssetType;
(function (AudioProductionAssetType) {
    AudioProductionAssetType["VoiceTrack"] = "voice-track";
    AudioProductionAssetType["MusicTrack"] = "music-track";
    AudioProductionAssetType["SoundEffect"] = "sound-effect";
    AudioProductionAssetType["AmbientTrack"] = "ambient-track";
    AudioProductionAssetType["MultiTrackSession"] = "multi-track-session";
    AudioProductionAssetType["VoiceProfile"] = "voice-profile";
    AudioProductionAssetType["Template"] = "template";
    AudioProductionAssetType["Metadata"] = "metadata";
    AudioProductionAssetType["BrandAsset"] = "brand-asset";
    AudioProductionAssetType["AudioPreset"] = "audio-preset";
})(AudioProductionAssetType || (AudioProductionAssetType = {}));
export var AudioProductionDependency;
(function (AudioProductionDependency) {
    AudioProductionDependency["MemoryEngine"] = "memory-engine";
    AudioProductionDependency["KnowledgeEngine"] = "knowledge-engine";
    AudioProductionDependency["ProductIntelligenceEngine"] = "product-intelligence-engine";
    AudioProductionDependency["ImageIntelligenceEngine"] = "image-intelligence-engine";
    AudioProductionDependency["VideoIntelligenceEngine"] = "video-intelligence-engine";
    AudioProductionDependency["VideoGenerationEngine"] = "video-generation-engine";
    AudioProductionDependency["ImageGenerationEngine"] = "image-generation-engine";
    AudioProductionDependency["AudioGenerationFoundation"] = "audio-generation-foundation";
    AudioProductionDependency["TextToSpeechEngine"] = "text-to-speech-generation-engine";
    AudioProductionDependency["SpeechToSpeechEngine"] = "speech-to-speech-generation-engine";
    AudioProductionDependency["VoiceCloningEngine"] = "voice-cloning-generation-engine";
    AudioProductionDependency["MusicGenerationEngine"] = "music-generation-engine";
    AudioProductionDependency["SoundEffectsEngine"] = "sound-effects-generation-engine";
    AudioProductionDependency["AmbientAudioEngine"] = "ambient-audio-generation-engine";
    AudioProductionDependency["AudioEnhancementEngine"] = "audio-enhancement-generation-engine";
    AudioProductionDependency["AudioMixingMasteringEngine"] = "audio-mixing-generation-engine";
})(AudioProductionDependency || (AudioProductionDependency = {}));
export var AudioProductionExportFormat;
(function (AudioProductionExportFormat) {
    AudioProductionExportFormat["Wav"] = "wav";
    AudioProductionExportFormat["Mp3"] = "mp3";
    AudioProductionExportFormat["Flac"] = "flac";
    AudioProductionExportFormat["Aac"] = "aac";
    AudioProductionExportFormat["Ogg"] = "ogg";
    AudioProductionExportFormat["Aiff"] = "aiff";
})(AudioProductionExportFormat || (AudioProductionExportFormat = {}));
export class AudioProductionEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AudioProductionEngineError";
    }
}
export const ALL_AUDIO_PRODUCTION_WORKFLOW_STAGES = Object.values(AudioProductionWorkflowStage);
export const ALL_AUDIO_PRODUCTION_ASSET_TYPES = Object.values(AudioProductionAssetType);
export const ALL_AUDIO_PRODUCTION_DEPENDENCIES = Object.values(AudioProductionDependency);
export const ALL_AUDIO_PRODUCTION_EXPORT_FORMATS = Object.values(AudioProductionExportFormat);
export const ALL_AUDIO_PRODUCTION_PLATFORMS = Object.values(AudioProductionPlatform);
export const WORKFLOW_MODULE_MAP = {
    [AudioProductionWorkflowStage.TextToSpeech]: "text-to-speech-generation-engine",
    [AudioProductionWorkflowStage.SpeechToSpeech]: "speech-to-speech-generation-engine",
    [AudioProductionWorkflowStage.VoiceCloning]: "voice-cloning-generation-engine",
    [AudioProductionWorkflowStage.MusicGeneration]: "music-generation-engine",
    [AudioProductionWorkflowStage.SoundEffectsGeneration]: "sound-effects-generation-engine",
    [AudioProductionWorkflowStage.AmbientAudioGeneration]: "ambient-audio-generation-engine",
    [AudioProductionWorkflowStage.AudioEnhancement]: "audio-enhancement-generation-engine",
    [AudioProductionWorkflowStage.AudioRestoration]: "audio-enhancement-generation-engine",
    [AudioProductionWorkflowStage.AudioMixing]: "audio-mixing-generation-engine",
    [AudioProductionWorkflowStage.AudioMastering]: "audio-mixing-generation-engine",
    [AudioProductionWorkflowStage.ProductionWorkflow]: "audio-generation-foundation",
};
export const DEPENDENCY_MODULE_MAP = {
    [AudioProductionDependency.TextToSpeechEngine]: "text-to-speech-generation-engine",
    [AudioProductionDependency.SpeechToSpeechEngine]: "speech-to-speech-generation-engine",
    [AudioProductionDependency.VoiceCloningEngine]: "voice-cloning-generation-engine",
    [AudioProductionDependency.MusicGenerationEngine]: "music-generation-engine",
    [AudioProductionDependency.SoundEffectsEngine]: "sound-effects-generation-engine",
    [AudioProductionDependency.AmbientAudioEngine]: "ambient-audio-generation-engine",
    [AudioProductionDependency.AudioEnhancementEngine]: "audio-enhancement-generation-engine",
    [AudioProductionDependency.AudioMixingMasteringEngine]: "audio-mixing-generation-engine",
};
export const AUDIO_PRODUCTION_PLATFORM_CONFIG = {
    [AudioProductionPlatform.Website]: { targetLufs: -16, sampleRate: 48000, channelLayout: "stereo" },
    [AudioProductionPlatform.Mobile]: { targetLufs: -16, sampleRate: 48000, channelLayout: "stereo" },
    [AudioProductionPlatform.Podcast]: { targetLufs: -16, sampleRate: 48000, channelLayout: "mono-stereo" },
    [AudioProductionPlatform.Audiobook]: { targetLufs: -18, sampleRate: 48000, channelLayout: "mono" },
    [AudioProductionPlatform.YouTube]: { targetLufs: -14, sampleRate: 48000, channelLayout: "stereo" },
    [AudioProductionPlatform.TikTok]: { targetLufs: -14, sampleRate: 48000, channelLayout: "stereo" },
    [AudioProductionPlatform.Instagram]: { targetLufs: -14, sampleRate: 48000, channelLayout: "stereo" },
    [AudioProductionPlatform.Television]: { targetLufs: -24, sampleRate: 48000, channelLayout: "stereo" },
    [AudioProductionPlatform.Radio]: { targetLufs: -23, sampleRate: 48000, channelLayout: "stereo" },
    [AudioProductionPlatform.Film]: { targetLufs: -27, sampleRate: 48000, channelLayout: "5.1-surround" },
};
//# sourceMappingURL=types.js.map
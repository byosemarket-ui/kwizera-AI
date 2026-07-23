/**
 * KWIZERA AI STUDIO — Audio Rendering Preparation Engine types (Step 10K)
 */
export var AudioRenderPlatform;
(function (AudioRenderPlatform) {
    AudioRenderPlatform["Website"] = "website";
    AudioRenderPlatform["Mobile"] = "mobile";
    AudioRenderPlatform["Podcast"] = "podcast";
    AudioRenderPlatform["Audiobook"] = "audiobook";
    AudioRenderPlatform["YouTube"] = "youtube";
    AudioRenderPlatform["TikTok"] = "tiktok";
    AudioRenderPlatform["Instagram"] = "instagram";
    AudioRenderPlatform["Television"] = "television";
    AudioRenderPlatform["Radio"] = "radio";
    AudioRenderPlatform["Film"] = "film";
})(AudioRenderPlatform || (AudioRenderPlatform = {}));
export var AudioRenderValidationStage;
(function (AudioRenderValidationStage) {
    AudioRenderValidationStage["TextToSpeech"] = "text-to-speech";
    AudioRenderValidationStage["SpeechToSpeech"] = "speech-to-speech";
    AudioRenderValidationStage["VoiceCloning"] = "voice-cloning";
    AudioRenderValidationStage["MusicGeneration"] = "music-generation";
    AudioRenderValidationStage["SoundEffectsGeneration"] = "sound-effects-generation";
    AudioRenderValidationStage["AmbientAudioGeneration"] = "ambient-audio-generation";
    AudioRenderValidationStage["AudioEnhancement"] = "audio-enhancement";
    AudioRenderValidationStage["AudioRestoration"] = "audio-restoration";
    AudioRenderValidationStage["AudioMixing"] = "audio-mixing";
    AudioRenderValidationStage["AudioMastering"] = "audio-mastering";
    AudioRenderValidationStage["ProductionPlans"] = "production-plans";
})(AudioRenderValidationStage || (AudioRenderValidationStage = {}));
export var AudioRenderTrackCheck;
(function (AudioRenderTrackCheck) {
    AudioRenderTrackCheck["TrackHierarchy"] = "track-hierarchy";
    AudioRenderTrackCheck["TrackOrder"] = "track-order";
    AudioRenderTrackCheck["TrackGroups"] = "track-groups";
    AudioRenderTrackCheck["BusRouting"] = "bus-routing";
    AudioRenderTrackCheck["SendRouting"] = "send-routing";
    AudioRenderTrackCheck["Automation"] = "automation";
    AudioRenderTrackCheck["MuteSoloStatus"] = "mute-solo-status";
})(AudioRenderTrackCheck || (AudioRenderTrackCheck = {}));
export var AudioRenderTimelineCheck;
(function (AudioRenderTimelineCheck) {
    AudioRenderTimelineCheck["TimelineAlignment"] = "timeline-alignment";
    AudioRenderTimelineCheck["CuePoints"] = "cue-points";
    AudioRenderTimelineCheck["TrackPosition"] = "track-position";
    AudioRenderTimelineCheck["FadeIn"] = "fade-in";
    AudioRenderTimelineCheck["FadeOut"] = "fade-out";
    AudioRenderTimelineCheck["Crossfade"] = "crossfade";
    AudioRenderTimelineCheck["LoopIntegrity"] = "loop-integrity";
})(AudioRenderTimelineCheck || (AudioRenderTimelineCheck = {}));
export var AudioRenderAssetType;
(function (AudioRenderAssetType) {
    AudioRenderAssetType["VoiceTrack"] = "voice-track";
    AudioRenderAssetType["MusicTrack"] = "music-track";
    AudioRenderAssetType["AmbientTrack"] = "ambient-track";
    AudioRenderAssetType["SoundEffect"] = "sound-effect";
    AudioRenderAssetType["AudioPreset"] = "audio-preset";
    AudioRenderAssetType["Metadata"] = "metadata";
    AudioRenderAssetType["BrandAsset"] = "brand-asset";
    AudioRenderAssetType["SessionTemplate"] = "session-template";
})(AudioRenderAssetType || (AudioRenderAssetType = {}));
export var AudioRenderChannelLayout;
(function (AudioRenderChannelLayout) {
    AudioRenderChannelLayout["Mono"] = "mono";
    AudioRenderChannelLayout["Stereo"] = "stereo";
    AudioRenderChannelLayout["Surround"] = "surround";
})(AudioRenderChannelLayout || (AudioRenderChannelLayout = {}));
export var AudioRenderCodec;
(function (AudioRenderCodec) {
    AudioRenderCodec["Wav"] = "wav";
    AudioRenderCodec["Mp3"] = "mp3";
    AudioRenderCodec["Flac"] = "flac";
    AudioRenderCodec["Aac"] = "aac";
    AudioRenderCodec["Ogg"] = "ogg";
    AudioRenderCodec["Aiff"] = "aiff";
})(AudioRenderCodec || (AudioRenderCodec = {}));
export class AudioRenderEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AudioRenderEngineError";
    }
}
export const ALL_AUDIO_RENDER_PLATFORMS = Object.values(AudioRenderPlatform);
export const ALL_AUDIO_RENDER_VALIDATION_STAGES = Object.values(AudioRenderValidationStage);
export const ALL_AUDIO_RENDER_TRACK_CHECKS = Object.values(AudioRenderTrackCheck);
export const ALL_AUDIO_RENDER_TIMELINE_CHECKS = Object.values(AudioRenderTimelineCheck);
export const ALL_AUDIO_RENDER_ASSET_TYPES = Object.values(AudioRenderAssetType);
export const AUDIO_RENDER_VALIDATION_MODULE_MAP = {
    [AudioRenderValidationStage.TextToSpeech]: "text-to-speech-generation-engine",
    [AudioRenderValidationStage.SpeechToSpeech]: "speech-to-speech-generation-engine",
    [AudioRenderValidationStage.VoiceCloning]: "voice-cloning-generation-engine",
    [AudioRenderValidationStage.MusicGeneration]: "music-generation-engine",
    [AudioRenderValidationStage.SoundEffectsGeneration]: "sound-effects-generation-engine",
    [AudioRenderValidationStage.AmbientAudioGeneration]: "ambient-audio-generation-engine",
    [AudioRenderValidationStage.AudioEnhancement]: "audio-enhancement-generation-engine",
    [AudioRenderValidationStage.AudioRestoration]: "audio-enhancement-generation-engine",
    [AudioRenderValidationStage.AudioMixing]: "audio-mixing-generation-engine",
    [AudioRenderValidationStage.AudioMastering]: "audio-mixing-generation-engine",
    [AudioRenderValidationStage.ProductionPlans]: "audio-production-engine",
};
export const AUDIO_RENDER_PLATFORM_CONFIG = {
    [AudioRenderPlatform.Website]: { sampleRate: 48000, bitDepth: 24, channelLayout: AudioRenderChannelLayout.Stereo, loudnessTarget: -16, dynamicRange: "medium", codec: AudioRenderCodec.Aac, compressionStrategy: "streaming-optimized", outputQuality: 90 },
    [AudioRenderPlatform.Mobile]: { sampleRate: 48000, bitDepth: 24, channelLayout: AudioRenderChannelLayout.Stereo, loudnessTarget: -16, dynamicRange: "medium", codec: AudioRenderCodec.Aac, compressionStrategy: "mobile-optimized", outputQuality: 88 },
    [AudioRenderPlatform.Podcast]: { sampleRate: 48000, bitDepth: 24, channelLayout: AudioRenderChannelLayout.Stereo, loudnessTarget: -16, dynamicRange: "medium", codec: AudioRenderCodec.Mp3, compressionStrategy: "speech-optimized", outputQuality: 92 },
    [AudioRenderPlatform.Audiobook]: { sampleRate: 48000, bitDepth: 24, channelLayout: AudioRenderChannelLayout.Mono, loudnessTarget: -18, dynamicRange: "wide", codec: AudioRenderCodec.Mp3, compressionStrategy: "narration-optimized", outputQuality: 95 },
    [AudioRenderPlatform.YouTube]: { sampleRate: 48000, bitDepth: 24, channelLayout: AudioRenderChannelLayout.Stereo, loudnessTarget: -14, dynamicRange: "medium", codec: AudioRenderCodec.Aac, compressionStrategy: "platform-loudness", outputQuality: 92 },
    [AudioRenderPlatform.TikTok]: { sampleRate: 48000, bitDepth: 24, channelLayout: AudioRenderChannelLayout.Stereo, loudnessTarget: -14, dynamicRange: "compressed", codec: AudioRenderCodec.Aac, compressionStrategy: "short-form", outputQuality: 88 },
    [AudioRenderPlatform.Instagram]: { sampleRate: 48000, bitDepth: 24, channelLayout: AudioRenderChannelLayout.Stereo, loudnessTarget: -14, dynamicRange: "compressed", codec: AudioRenderCodec.Aac, compressionStrategy: "social-optimized", outputQuality: 88 },
    [AudioRenderPlatform.Television]: { sampleRate: 48000, bitDepth: 24, channelLayout: AudioRenderChannelLayout.Stereo, loudnessTarget: -24, dynamicRange: "broadcast", codec: AudioRenderCodec.Wav, compressionStrategy: "broadcast-standard", outputQuality: 98 },
    [AudioRenderPlatform.Radio]: { sampleRate: 48000, bitDepth: 24, channelLayout: AudioRenderChannelLayout.Stereo, loudnessTarget: -23, dynamicRange: "broadcast", codec: AudioRenderCodec.Mp3, compressionStrategy: "radio-standard", outputQuality: 95 },
    [AudioRenderPlatform.Film]: { sampleRate: 48000, bitDepth: 24, channelLayout: AudioRenderChannelLayout.Surround, loudnessTarget: -27, dynamicRange: "cinema", codec: AudioRenderCodec.Flac, compressionStrategy: "lossless-preferred", outputQuality: 100 },
};
//# sourceMappingURL=types.js.map
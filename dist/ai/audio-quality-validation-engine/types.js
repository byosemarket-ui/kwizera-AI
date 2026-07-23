/**
 * KWIZERA AI STUDIO — Audio Quality Validation Engine types (Step 10L)
 */
export var AudioQualityValidationPlatform;
(function (AudioQualityValidationPlatform) {
    AudioQualityValidationPlatform["Website"] = "website";
    AudioQualityValidationPlatform["Mobile"] = "mobile";
    AudioQualityValidationPlatform["Podcast"] = "podcast";
    AudioQualityValidationPlatform["Audiobook"] = "audiobook";
    AudioQualityValidationPlatform["YouTube"] = "youtube";
    AudioQualityValidationPlatform["TikTok"] = "tiktok";
    AudioQualityValidationPlatform["Instagram"] = "instagram";
    AudioQualityValidationPlatform["Television"] = "television";
    AudioQualityValidationPlatform["Radio"] = "radio";
    AudioQualityValidationPlatform["Film"] = "film";
})(AudioQualityValidationPlatform || (AudioQualityValidationPlatform = {}));
export var AudioQualityCheck;
(function (AudioQualityCheck) {
    AudioQualityCheck["SampleRate"] = "sample-rate";
    AudioQualityCheck["BitDepth"] = "bit-depth";
    AudioQualityCheck["Loudness"] = "loudness";
    AudioQualityCheck["PeakLevel"] = "peak-level";
    AudioQualityCheck["DynamicRange"] = "dynamic-range";
    AudioQualityCheck["SignalToNoiseRatio"] = "signal-to-noise-ratio";
    AudioQualityCheck["Noise"] = "noise";
    AudioQualityCheck["Distortion"] = "distortion";
    AudioQualityCheck["Clipping"] = "clipping";
    AudioQualityCheck["FrequencyBalance"] = "frequency-balance";
})(AudioQualityCheck || (AudioQualityCheck = {}));
export var AudioQualityTrackCheck;
(function (AudioQualityTrackCheck) {
    AudioQualityTrackCheck["TrackStructure"] = "track-structure";
    AudioQualityTrackCheck["TrackOrder"] = "track-order";
    AudioQualityTrackCheck["TrackGroups"] = "track-groups";
    AudioQualityTrackCheck["BusRouting"] = "bus-routing";
    AudioQualityTrackCheck["SendRouting"] = "send-routing";
    AudioQualityTrackCheck["Automation"] = "automation";
    AudioQualityTrackCheck["MuteSoloStatus"] = "mute-solo-status";
})(AudioQualityTrackCheck || (AudioQualityTrackCheck = {}));
export var AudioQualityTimelineCheck;
(function (AudioQualityTimelineCheck) {
    AudioQualityTimelineCheck["TimelineAlignment"] = "timeline-alignment";
    AudioQualityTimelineCheck["CuePoints"] = "cue-points";
    AudioQualityTimelineCheck["FadeIn"] = "fade-in";
    AudioQualityTimelineCheck["FadeOut"] = "fade-out";
    AudioQualityTimelineCheck["Crossfade"] = "crossfade";
    AudioQualityTimelineCheck["LoopIntegrity"] = "loop-integrity";
})(AudioQualityTimelineCheck || (AudioQualityTimelineCheck = {}));
export var AudioSyncCheck;
(function (AudioSyncCheck) {
    AudioSyncCheck["VideoSync"] = "video-sync";
    AudioSyncCheck["LipSyncMetadata"] = "lip-sync-metadata";
    AudioSyncCheck["DialogueTiming"] = "dialogue-timing";
    AudioSyncCheck["MusicTiming"] = "music-timing";
    AudioSyncCheck["SoundEffectsTiming"] = "sound-effects-timing";
    AudioSyncCheck["AmbientTiming"] = "ambient-timing";
})(AudioSyncCheck || (AudioSyncCheck = {}));
export var AudioBrandValidationCheck;
(function (AudioBrandValidationCheck) {
    AudioBrandValidationCheck["BrandAudioIdentity"] = "brand-audio-identity";
    AudioBrandValidationCheck["VoiceIdentity"] = "voice-identity";
    AudioBrandValidationCheck["AudioStyle"] = "audio-style";
    AudioBrandValidationCheck["CampaignConsistency"] = "campaign-consistency";
})(AudioBrandValidationCheck || (AudioBrandValidationCheck = {}));
export var AudioTechnicalValidationCheck;
(function (AudioTechnicalValidationCheck) {
    AudioTechnicalValidationCheck["Codec"] = "codec";
    AudioTechnicalValidationCheck["ChannelLayout"] = "channel-layout";
    AudioTechnicalValidationCheck["Metadata"] = "metadata";
    AudioTechnicalValidationCheck["FileFormat"] = "file-format";
    AudioTechnicalValidationCheck["Compression"] = "compression";
    AudioTechnicalValidationCheck["LoudnessTarget"] = "loudness-target";
    AudioTechnicalValidationCheck["ExportSettings"] = "export-settings";
})(AudioTechnicalValidationCheck || (AudioTechnicalValidationCheck = {}));
export var AudioQualityIssueSeverity;
(function (AudioQualityIssueSeverity) {
    AudioQualityIssueSeverity["Low"] = "low";
    AudioQualityIssueSeverity["Medium"] = "medium";
    AudioQualityIssueSeverity["High"] = "high";
    AudioQualityIssueSeverity["Critical"] = "critical";
})(AudioQualityIssueSeverity || (AudioQualityIssueSeverity = {}));
export var AudioQualityIssueCategory;
(function (AudioQualityIssueCategory) {
    AudioQualityIssueCategory["MissingAsset"] = "missing-asset";
    AudioQualityIssueCategory["BrokenTrack"] = "broken-track";
    AudioQualityIssueCategory["TimelineProblem"] = "timeline-problem";
    AudioQualityIssueCategory["SyncProblem"] = "sync-problem";
    AudioQualityIssueCategory["LoudnessProblem"] = "loudness-problem";
    AudioQualityIssueCategory["Clipping"] = "clipping";
    AudioQualityIssueCategory["Distortion"] = "distortion";
    AudioQualityIssueCategory["MetadataProblem"] = "metadata-problem";
    AudioQualityIssueCategory["Branding"] = "branding";
    AudioQualityIssueCategory["RenderingRisk"] = "rendering-risk";
})(AudioQualityIssueCategory || (AudioQualityIssueCategory = {}));
export class AudioQualityValidationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AudioQualityValidationEngineError";
    }
}
export const ALL_AUDIO_QUALITY_VALIDATION_PLATFORMS = Object.values(AudioQualityValidationPlatform);
export const ALL_AUDIO_QUALITY_CHECKS = Object.values(AudioQualityCheck);
export const ALL_AUDIO_QUALITY_TRACK_CHECKS = Object.values(AudioQualityTrackCheck);
export const ALL_AUDIO_QUALITY_TIMELINE_CHECKS = Object.values(AudioQualityTimelineCheck);
export const ALL_AUDIO_SYNC_CHECKS = Object.values(AudioSyncCheck);
export const ALL_AUDIO_BRAND_VALIDATION_CHECKS = Object.values(AudioBrandValidationCheck);
export const ALL_AUDIO_TECHNICAL_VALIDATION_CHECKS = Object.values(AudioTechnicalValidationCheck);
export const AUDIO_QUALITY_PLATFORM_CONFIG = {
    [AudioQualityValidationPlatform.Website]: { sampleRate: 48000, bitDepth: 24, loudnessTarget: -16, channelLayout: "stereo", codec: "aac" },
    [AudioQualityValidationPlatform.Mobile]: { sampleRate: 48000, bitDepth: 24, loudnessTarget: -16, channelLayout: "stereo", codec: "aac" },
    [AudioQualityValidationPlatform.Podcast]: { sampleRate: 48000, bitDepth: 24, loudnessTarget: -16, channelLayout: "stereo", codec: "mp3" },
    [AudioQualityValidationPlatform.Audiobook]: { sampleRate: 48000, bitDepth: 24, loudnessTarget: -18, channelLayout: "mono", codec: "mp3" },
    [AudioQualityValidationPlatform.YouTube]: { sampleRate: 48000, bitDepth: 24, loudnessTarget: -14, channelLayout: "stereo", codec: "aac" },
    [AudioQualityValidationPlatform.TikTok]: { sampleRate: 48000, bitDepth: 24, loudnessTarget: -14, channelLayout: "stereo", codec: "aac" },
    [AudioQualityValidationPlatform.Instagram]: { sampleRate: 48000, bitDepth: 24, loudnessTarget: -14, channelLayout: "stereo", codec: "aac" },
    [AudioQualityValidationPlatform.Television]: { sampleRate: 48000, bitDepth: 24, loudnessTarget: -24, channelLayout: "stereo", codec: "wav" },
    [AudioQualityValidationPlatform.Radio]: { sampleRate: 48000, bitDepth: 24, loudnessTarget: -23, channelLayout: "stereo", codec: "mp3" },
    [AudioQualityValidationPlatform.Film]: { sampleRate: 48000, bitDepth: 24, loudnessTarget: -27, channelLayout: "surround", codec: "flac" },
};
//# sourceMappingURL=types.js.map
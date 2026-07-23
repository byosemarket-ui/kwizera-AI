/**
 * KWIZERA AI STUDIO — Audio Mixing & Mastering Engine types (Step 10I)
 */
export var AudioMixingPlatform;
(function (AudioMixingPlatform) {
    AudioMixingPlatform["Website"] = "website";
    AudioMixingPlatform["Mobile"] = "mobile";
    AudioMixingPlatform["Podcast"] = "podcast";
    AudioMixingPlatform["Audiobook"] = "audiobook";
    AudioMixingPlatform["YouTube"] = "youtube";
    AudioMixingPlatform["TikTok"] = "tiktok";
    AudioMixingPlatform["Instagram"] = "instagram";
    AudioMixingPlatform["Television"] = "television";
    AudioMixingPlatform["Radio"] = "radio";
    AudioMixingPlatform["Film"] = "film";
})(AudioMixingPlatform || (AudioMixingPlatform = {}));
export var AudioTrackType;
(function (AudioTrackType) {
    AudioTrackType["Voice"] = "voice";
    AudioTrackType["Music"] = "music";
    AudioTrackType["Foley"] = "foley";
    AudioTrackType["Ambient"] = "ambient";
    AudioTrackType["Effects"] = "effects";
    AudioTrackType["Dialogue"] = "dialogue";
    AudioTrackType["Narration"] = "narration";
    AudioTrackType["MasterBus"] = "master-bus";
})(AudioTrackType || (AudioTrackType = {}));
export var MixingInputType;
(function (MixingInputType) {
    MixingInputType["VoiceTrack"] = "voice-track";
    MixingInputType["MusicTrack"] = "music-track";
    MixingInputType["AmbientTrack"] = "ambient-track";
    MixingInputType["SoundEffects"] = "sound-effects";
    MixingInputType["MultiTrackSession"] = "multi-track-session";
    MixingInputType["VideoTimeline"] = "video-timeline";
    MixingInputType["BrandGuidelines"] = "brand-guidelines";
    MixingInputType["KnowledgeRecord"] = "knowledge-record";
})(MixingInputType || (MixingInputType = {}));
export class AudioMixingMasteringEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AudioMixingMasteringEngineError";
    }
}
export const ALL_AUDIO_MIXING_PLATFORMS = Object.values(AudioMixingPlatform);
export const AUDIO_TRACK_TYPES = Object.values(AudioTrackType);
export const PLATFORM_MIX_MASTER_CONFIG = {
    [AudioMixingPlatform.Website]: { targetLufs: -16, formatNotes: "Web stereo AAC", loudnessStandard: "streaming" },
    [AudioMixingPlatform.Mobile]: { targetLufs: -16, formatNotes: "Mobile compressed stereo", loudnessStandard: "streaming" },
    [AudioMixingPlatform.Podcast]: { targetLufs: -16, formatNotes: "Podcast -16 LUFS", loudnessStandard: "podcast" },
    [AudioMixingPlatform.Audiobook]: { targetLufs: -18, formatNotes: "Audiobook narration", loudnessStandard: "podcast" },
    [AudioMixingPlatform.YouTube]: { targetLufs: -14, formatNotes: "YouTube normalization", loudnessStandard: "streaming" },
    [AudioMixingPlatform.TikTok]: { targetLufs: -14, formatNotes: "Short-form mobile", loudnessStandard: "streaming" },
    [AudioMixingPlatform.Instagram]: { targetLufs: -14, formatNotes: "Social media stereo", loudnessStandard: "streaming" },
    [AudioMixingPlatform.Television]: { targetLufs: -24, formatNotes: "EBU R128 broadcast", loudnessStandard: "television" },
    [AudioMixingPlatform.Radio]: { targetLufs: -23, formatNotes: "Radio broadcast", loudnessStandard: "radio" },
    [AudioMixingPlatform.Film]: { targetLufs: -27, formatNotes: "Cinema mix reference", loudnessStandard: "cinema" },
};
//# sourceMappingURL=types.js.map
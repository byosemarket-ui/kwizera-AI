/**
 * KWIZERA AI STUDIO — Audio Synchronization Engine types (Step 8H)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export var AudioSyncPlanType;
(function (AudioSyncPlanType) {
    AudioSyncPlanType["Voice"] = "voice";
    AudioSyncPlanType["Music"] = "music";
    AudioSyncPlanType["SoundEffect"] = "sound-effect";
    AudioSyncPlanType["Subtitle"] = "subtitle";
    AudioSyncPlanType["Mixed"] = "mixed";
    AudioSyncPlanType["Combined"] = "combined";
})(AudioSyncPlanType || (AudioSyncPlanType = {}));
export class AudioSynchronizationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AudioSynchronizationEngineError";
    }
}
export const AUDIO_SYNC_PLATFORM_TARGETS = [
    StoryboardGenerationPlatform.TikTok,
    StoryboardGenerationPlatform.InstagramReels,
    StoryboardGenerationPlatform.Facebook,
    StoryboardGenerationPlatform.YouTubeShorts,
    StoryboardGenerationPlatform.YouTubeLongForm,
    StoryboardGenerationPlatform.Website,
    StoryboardGenerationPlatform.Television,
];
export const PLATFORM_AUDIO_SYNC_CONFIG = {
    [StoryboardGenerationPlatform.TikTok]: { loudnessTarget: "-14 LUFS", musicMixRatio: "music-forward" },
    [StoryboardGenerationPlatform.InstagramReels]: { loudnessTarget: "-14 LUFS", musicMixRatio: "balanced" },
    [StoryboardGenerationPlatform.Facebook]: { loudnessTarget: "-16 LUFS", musicMixRatio: "voice-forward" },
    [StoryboardGenerationPlatform.YouTubeShorts]: { loudnessTarget: "-14 LUFS", musicMixRatio: "music-forward" },
    [StoryboardGenerationPlatform.YouTubeLongForm]: { loudnessTarget: "-16 LUFS", musicMixRatio: "cinematic" },
    [StoryboardGenerationPlatform.WhatsApp]: { loudnessTarget: "-16 LUFS", musicMixRatio: "voice-forward" },
    [StoryboardGenerationPlatform.Website]: { loudnessTarget: "-16 LUFS", musicMixRatio: "balanced" },
    [StoryboardGenerationPlatform.Television]: { loudnessTarget: "-24 LUFS", musicMixRatio: "broadcast" },
};
//# sourceMappingURL=types.js.map
/**
 * Product Marketing Video — customer Music view model.
 * Pure functions over the existing Audio Library / Audio Intelligence / AI Sound data.
 */
import {
  hasSteadyBeat,
  type PmvAudioIntelligenceView,
  type PmvAudioLibraryItem,
  type PmvBeatSyncMode,
  type PmvMusicCapabilityView,
} from "../../../pmv-final";

/** Names used by automated verification uploads; hidden only when they belong to another project. */
const TEST_AUDIO_NAME = [
  /^(step|phase)\d+[a-z]?[-_ ]/i,
  /^(?:[a-z]+-)?beat(?:-[a-z0-9]{1,4})?(?:-copy)?$/i,
  /^(silence|silent|sine|fixture|test)(?:[-_ ].*)?$/i,
  /\b(regression|fixture|e2e|smoke|verify|debug)\b/i,
  /^clip-source\b/i,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
];

export function looksLikeTestAudio(title: string): boolean {
  const name = title.trim();
  return !name || TEST_AUDIO_NAME.some((re) => re.test(name));
}

/**
 * Music the customer can pick for this project. Nothing is deleted: the project's own audio,
 * music added this session and the current selection are always kept; voice-overs and test
 * fixtures are never offered as music.
 */
export function customerMusicLibrary(
  library: PmvAudioLibraryItem[],
  projectId: string | null,
  selectedAssetId: string | null,
  addedAssetIds: readonly string[] = [],
): PmvAudioLibraryItem[] {
  return library.filter((item) => {
    if (item.assetId === selectedAssetId) return true;
    if (item.status !== "READY" || !item.playbackUrl) return false;
    if (item.voice || item.testFixture) return false;
    if (addedAssetIds.includes(item.assetId)) return true;
    if (projectId && item.ownerProjectId === projectId) return true;
    return !looksLikeTestAudio(item.title);
  });
}

/** Readable title: file-name underscores become spaces; the source is shown separately. */
export function audioDisplayTitle(item: Pick<PmvAudioLibraryItem, "title" | "sourceType">): string {
  let title = item.title.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  if (item.sourceType === "EXTRACTED_FROM_VIDEO") title = title.replace(/\s*[—-]\s*Extracted Audio$/i, "").trim();
  return title || (item.sourceType === "AI_GENERATED" ? "AI music" : "Music");
}

export function audioSourceLabel(item: Pick<PmvAudioLibraryItem, "sourceType">): string {
  if (item.sourceType === "AI_GENERATED") return "AI music";
  if (item.sourceType === "EXTRACTED_FROM_VIDEO") return "From a video";
  return "Uploaded";
}

export function formatAudioLength(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/* —— Beat Sync —— */

export const BEAT_SYNC_OPTIONS: Array<{ mode: PmvBeatSyncMode; label: string }> = [
  { mode: "SMART", label: "Auto" },
  { mode: "STRICT", label: "On" },
  { mode: "OFF", label: "Off" },
];

export type BeatSyncState = "no_music" | "checking" | "ready" | "weak" | "unavailable";

/** Mirrors the timeline rule: beats are only used when analysis is READY and found beats. */
export function beatSyncState(
  selectedAssetId: string | null,
  intelligence: PmvAudioIntelligenceView | null,
): BeatSyncState {
  if (!selectedAssetId) return "no_music";
  if (!intelligence) return "checking";
  const status = intelligence.status.toUpperCase();
  if (status === "READY") {
    if (intelligence.beatCount <= 0) return "unavailable";
    return hasSteadyBeat(intelligence) ? "ready" : "weak";
  }
  if (status === "QUEUED" || status === "PENDING" || status === "ANALYZING" || status === "RUNNING") return "checking";
  return "unavailable";
}

/** Whether scenes will actually follow the beat for this state and mode. */
export function beatSyncActive(state: BeatSyncState, mode: PmvBeatSyncMode): boolean {
  if (mode === "OFF") return false;
  if (state === "ready") return true;
  return state === "weak" && mode === "STRICT";
}

export function beatSyncNote(state: BeatSyncState, mode: PmvBeatSyncMode): string | null {
  if (state === "no_music") return null;
  if (state === "checking") return "Checking the beat of this music…";
  if (state === "unavailable") return "No clear beat was found in this music, so scenes use standard timing.";
  if (mode === "OFF") return "Scenes use standard timing.";
  if (state === "weak" && mode === "SMART") {
    return "The beat in this music is soft, so Auto keeps standard timing. Choose On to follow it anyway.";
  }
  return mode === "STRICT" ? "Scene changes land on the beat." : "Scene changes follow the beat where it fits.";
}

/* —— AI music —— */

export const MUSIC_MOODS = [
  { value: "AUTO", label: "Match my product" },
  { value: "ENERGETIC", label: "Energetic" },
  { value: "PREMIUM", label: "Premium" },
  { value: "MODERN", label: "Modern" },
  { value: "WARM", label: "Warm" },
  { value: "CINEMATIC", label: "Cinematic" },
  { value: "PLAYFUL", label: "Playful" },
  { value: "CALM", label: "Calm" },
] as const;

export const MUSIC_ENERGY = [
  { value: "AUTO", label: "Auto" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
] as const;

export const MUSIC_TEMPO = [
  { value: "AUTO", label: "Auto" },
  { value: "SLOW", label: "Slow" },
  { value: "MEDIUM", label: "Medium" },
  { value: "FAST", label: "Fast" },
] as const;

export type MusicMoodValue = typeof MUSIC_MOODS[number]["value"];
export type MusicEnergyValue = typeof MUSIC_ENERGY[number]["value"];
export type MusicTempoValue = typeof MUSIC_TEMPO[number]["value"];

export interface AiMusicRequest {
  mood: MusicMoodValue;
  energy: MusicEnergyValue;
  tempo: MusicTempoValue;
  durationSeconds: number;
}

/** AI music length follows the video, within what music creation supports (5 s – 2 min). */
export const AI_MUSIC_MIN_SECONDS = 5;
export const AI_MUSIC_MAX_SECONDS = 120;

export function aiMusicDurationSeconds(videoSeconds: number): number {
  if (!Number.isFinite(videoSeconds) || videoSeconds <= 0) return 15;
  return Math.min(AI_MUSIC_MAX_SECONDS, Math.max(AI_MUSIC_MIN_SECONDS, Math.round(videoSeconds)));
}

export function aiMusicAvailable(capability: PmvMusicCapabilityView): boolean {
  return capability.available && capability.status === "AVAILABLE";
}

export const AI_MUSIC_UNAVAILABLE = "AI music isn't available right now. You can upload music or use the sound from a video.";

export function aiMusicErrorMessage(code: string | null | undefined): string {
  switch ((code ?? "").toUpperCase()) {
    case "MUSIC_GENERATION_UNAVAILABLE":
    case "NOT_READY":
      return AI_MUSIC_UNAVAILABLE;
    case "RESOURCE_LIMITED":
      return "Another music track is being created. Please wait for it to finish.";
    case "TIMEOUT":
      return "Creating music took too long. Please try again.";
    case "CANCELLED":
      return "Music creation was cancelled.";
    default:
      return "We couldn't create music this time. Please try again.";
  }
}

export function aiMusicStageLabel(status: string): string {
  switch (status) {
    case "QUEUED": return "Waiting to start…";
    case "PREPARING": return "Preparing…";
    case "GENERATING": return "Creating your music…";
    case "FINALIZING":
    case "VALIDATING": return "Checking the music…";
    case "ANALYZING": return "Finding the beat…";
    case "SAVING": return "Saving to your music…";
    default: return "Creating your music…";
  }
}

/* —— Files —— */

export const AUDIO_FILE_ACCEPT = "audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg,.opus";
export const VIDEO_FILE_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm";

/** Upload requests are capped at 70 MB and files travel base64-encoded (4/3 larger). */
export const MAX_AUDIO_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_FILE_BYTES = 50 * 1024 * 1024;

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|opus)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

export function validateAudioFile(file: { name: string; type: string; size: number }): string | null {
  if (!file.size) return "This file is empty.";
  if (!(AUDIO_EXT.test(file.name) || /^audio\/(mpeg|mp3|wav|wave|x-wav|mp4|aac|x-m4a|m4a|ogg|opus)$/i.test(file.type))) {
    return "Please choose an MP3, WAV, M4A, AAC or OGG file.";
  }
  if (file.size > MAX_AUDIO_FILE_BYTES) return "Music files can be up to 50 MB.";
  return null;
}

export function audioFileErrorMessage(code: string | null | undefined, kind: "upload" | "extract"): string {
  switch ((code ?? "").toUpperCase()) {
    case "UNSUPPORTED_FORMAT":
      return kind === "extract" ? "Please choose an MP4, MOV or WEBM video." : "Please choose an MP3, WAV, M4A, AAC or OGG file.";
    case "CORRUPT_AUDIO":
    case "DECODE_FAILED":
      return kind === "extract" ? "We couldn't read the sound in this video." : "We couldn't read this music file.";
    case "NO_AUDIO_STREAM":
      return "This video has no sound to use.";
    case "EMPTY_FILE":
      return "This file is empty.";
    case "FILE_TOO_LARGE":
    case "PAYLOAD_TOO_LARGE":
      return kind === "extract" ? "Videos can be up to 50 MB for taking the sound." : "Music files can be up to 50 MB.";
    default:
      return kind === "extract"
        ? "We couldn't take the sound from this video. Please try again."
        : "Your music could not be uploaded. Please try again.";
  }
}

export function validateVideoFile(file: { name: string; type: string; size: number }): string | null {
  if (!file.size) return "This file is empty.";
  if (!(VIDEO_EXT.test(file.name) || file.type.startsWith("video/"))) {
    return "Please choose an MP4, MOV or WEBM video.";
  }
  if (file.size > MAX_VIDEO_FILE_BYTES) return "Videos can be up to 50 MB for taking the sound.";
  return null;
}

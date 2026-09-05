/**
 * STEP 2B — Audio Asset foundation (library + project selection).
 * Beat detection / AI music are intentionally out of scope.
 */

export const AUDIO_ASSET_VERSION = "step2b-audio-asset-v1";

/** Implemented in STEP 2B. AI_GENERATED reserved for STEP 2E. */
export type AudioSourceType = "UPLOADED_AUDIO" | "EXTRACTED_FROM_VIDEO" | "AI_GENERATED";

export type AudioAssetStatus =
  | "SELECTED"
  | "VALIDATING"
  | "HASHING"
  | "QUEUED"
  | "UPLOADING"
  | "STORED"
  | "INSPECTING"
  | "READY"
  | "VALIDATION_FAILED"
  | "UPLOAD_FAILED"
  | "INSPECTION_FAILED";

/**
 * Extensible metadata — BPM / beats / mood reserved for STEP 2C+.
 * Existing assets must remain loadable when those fields appear later.
 */
export interface AudioAssetMetadata {
  codec?: string | null;
  sampleRate?: number | null;
  channels?: number | null;
  bitrate?: number | null;
  container?: string | null;
  /** Reserved STEP 2C — never populated in STEP 2B */
  bpm?: number | null;
  tempo?: number | null;
  energy?: number | null;
  beats?: unknown;
  sections?: unknown;
  mood?: string | null;
  [key: string]: unknown;
}

export interface AudioAsset {
  assetId: string;
  type: "AUDIO";
  sourceType: AudioSourceType;
  originalFilename: string;
  title: string;
  mimeType: string;
  durationMs: number;
  fileSize: number;
  /** Controlled storage filename under audio-library/ — never a raw FS path for clients */
  storageFileName: string;
  /** Public playback URL */
  playbackUrl: string;
  contentHash: string;
  status: AudioAssetStatus;
  metadata: AudioAssetMetadata;
  createdAt: string;
  updatedAt: string;
  /** Project that imported/extracted this asset (provenance only; library is studio-scoped) */
  ownerProjectId?: string | null;
  /** When extracted from a project video asset */
  parentVideoAssetId?: string | null;
  parentVideoFileName?: string | null;
}

export interface ProjectAudioSelection {
  selectedAudioAssetId: string | null;
  enabled: boolean;
  /** 0–1 linear gain; default 1 */
  volume: number;
}

export const DEFAULT_PROJECT_AUDIO: ProjectAudioSelection = {
  selectedAudioAssetId: null,
  enabled: false,
  volume: 1,
};

export const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/m4a",
  "audio/ogg",
  "audio/opus",
]);

export const AUDIO_EXT_BY_MIME: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/aac": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
};

export const MAX_AUDIO_BYTES_DEFAULT = 50 * 1024 * 1024;

export function maxAudioBytes(): number {
  const raw = process.env.KWIZERA_MAX_AUDIO_BYTES;
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 1024 * 1024 && n <= 500 * 1024 * 1024) return n;
  }
  return MAX_AUDIO_BYTES_DEFAULT;
}

export function normalizeAudioMime(mime: string, fileName?: string): string | null {
  const m = (mime || "").toLowerCase().split(";")[0]!.trim();
  if (ALLOWED_AUDIO_MIME_TYPES.has(m)) {
    if (m === "audio/mp3") return "audio/mpeg";
    if (m === "audio/wave" || m === "audio/x-wav") return "audio/wav";
    if (m === "audio/m4a" || m === "audio/x-m4a") return "audio/mp4";
    return m;
  }
  const ext = (fileName ?? "").toLowerCase().replace(/^.*\./, "");
  const byExt: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    opus: "audio/ogg",
  };
  return byExt[ext] ?? null;
}

export function audioExtensionForMime(mime: string): string {
  return AUDIO_EXT_BY_MIME[mime] ?? "bin";
}

export function sanitizeAudioFileName(fileName: string, fallbackExt: string): string {
  const base = fileName.replace(/\\/g, "/").split("/").pop() ?? "audio";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "") || `audio.${fallbackExt}`;
  if (cleaned.includes("..")) return `audio.${fallbackExt}`;
  return cleaned.slice(0, 180);
}

export function extractedAudioTitle(videoFileName: string): string {
  const base = videoFileName.replace(/\.[^.]+$/, "").trim() || "Video";
  const safe = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim() || "Video";
  return `${safe} — Extracted Audio`;
}

export function formatAudioDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function normalizeProjectAudio(
  raw: Partial<ProjectAudioSelection> | null | undefined,
): ProjectAudioSelection {
  if (!raw) return { ...DEFAULT_PROJECT_AUDIO };
  const id = typeof raw.selectedAudioAssetId === "string" && raw.selectedAudioAssetId.trim()
    ? raw.selectedAudioAssetId.trim()
    : null;
  const volume = typeof raw.volume === "number" && Number.isFinite(raw.volume)
    ? Math.min(1, Math.max(0, raw.volume))
    : 1;
  const enabled = Boolean(raw.enabled) && Boolean(id);
  return {
    selectedAudioAssetId: id,
    enabled,
    volume,
  };
}

export function isSafeAudioStorageFileName(name: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|wav|m4a|ogg|aac)$/i.test(name);
}

export function audioUserError(code: string, fallback: string): string {
  switch (code) {
    case "UNSUPPORTED_FORMAT":
      return "This audio format is not supported.";
    case "CORRUPT_AUDIO":
    case "DECODE_FAILED":
      return "The audio file could not be decoded.";
    case "NO_AUDIO_STREAM":
      return "No audio stream was found in this video.";
    case "EMPTY_FILE":
      return "The audio file is empty.";
    case "FILE_TOO_LARGE":
      return `Audio file exceeds the maximum size of ${Math.round(maxAudioBytes() / (1024 * 1024))} MB.`;
    case "UPLOAD_FAILED":
      return "Audio upload failed. Retry.";
    case "EXTRACTION_FAILED":
      return "Audio extraction failed. Retry.";
    case "ASSET_IN_USE":
      return "This audio is still used by one or more projects and cannot be deleted.";
    case "ASSET_NOT_FOUND":
      return "Audio asset not found.";
    default:
      return fallback;
  }
}

/**
 * STEP 2E — AI Sound Engine types.
 * Music generation provider abstraction + MusicGenerationSpec contract.
 * Does NOT claim a music model exists when none is configured.
 */

export const AI_SOUND_VERSION = "ai-sound-v1";
export const MUSIC_GENERATION_SPEC_VERSION = "music-generation-spec-v1";
export const AUDIO_STYLE_PROFILE_VERSION = "audio-style-profile-v1";

export type MusicGenerationMode =
  | "PRODUCT_CONTEXT"
  | "STYLE_PROFILE"
  | "REFERENCE_CHARACTERISTICS"
  | "COMBINED";

export type MusicGenerationProviderStatus =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "MISCONFIGURED"
  | "MODEL_MISSING"
  | "RESOURCE_LIMITED"
  | "ERROR";

export type AiSoundJobLifecycle =
  | "QUEUED"
  | "PREPARING"
  | "GENERATING"
  | "FINALIZING"
  | "VALIDATING"
  | "ANALYZING"
  | "SAVING"
  | "READY"
  | "FAILED"
  | "CANCELLED"
  | "TIMEOUT";

export type MusicMood =
  | "AUTO"
  | "ENERGETIC"
  | "PREMIUM"
  | "WARM"
  | "MODERN"
  | "CINEMATIC"
  | "PLAYFUL"
  | "CALM";

export type MusicEnergyLevel = "AUTO" | "LOW" | "MEDIUM" | "HIGH";
export type MusicTempoPreference = "AUTO" | "SLOW" | "MEDIUM" | "FAST";

export interface MusicStructureSection {
  label: "intro" | "build" | "main" | "climax" | "outro";
  weight: number;
}

export interface MusicGenerationSpec {
  version: typeof MUSIC_GENERATION_SPEC_VERSION;
  purpose: "commercial_product_video";
  mode: MusicGenerationMode;
  durationSeconds: number;
  genre: string;
  mood: Exclude<MusicMood, "AUTO">;
  energy: Exclude<MusicEnergyLevel, "AUTO">;
  tempoRange: [number, number];
  instrumentation: string[];
  rhythm: string;
  structure: MusicStructureSection[];
  introStyle: string;
  climaxStyle: string;
  outroStyle: string;
  vocalMode: "none";
  instrumentalOnly: true;
  advertisingIntensity: "low" | "medium" | "high";
  platform?: string;
  productCategory?: string;
  styleProfileId?: string | null;
  referenceAudioAssetIds?: string[];
  userNotes?: string | null;
  createdAt: string;
}

export interface AudioStylePreferences {
  bpmMin: number | null;
  bpmMax: number | null;
  preferredEnergy: "low" | "medium" | "high" | null;
  rhythmDensity: "sparse" | "normal" | "dense" | null;
  instrumentationHints: string[];
  introPreference: "short" | "medium" | "long" | null;
  climaxPreference: "early" | "mid" | "late" | null;
  outroPreference: "soft" | "strong" | null;
  advertisingIntensity: "low" | "medium" | "high" | null;
  moods: string[];
}

export interface AudioStyleProfile {
  profileId: string;
  version: typeof AUDIO_STYLE_PROFILE_VERSION;
  name: string;
  /** null = studio-scoped user preference; otherwise project-bound */
  projectId: string | null;
  preferences: AudioStylePreferences;
  sourceAudioAssetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MusicProviderHealth {
  providerId: string;
  status: MusicGenerationProviderStatus;
  available: boolean;
  modelId: string | null;
  modelVersion: string | null;
  capabilities: string[];
  reason: string | null;
  resourceStatus?: {
    ramFreeMb?: number;
    storageFreeMb?: number;
    concurrentJobs?: number;
  };
  checkedAt: string;
}

export interface MusicGenerationRequest {
  projectId: string;
  spec: MusicGenerationSpec;
  titleHint?: string;
}

export interface MusicGenerationResult {
  filePath: string;
  mimeType: string;
  durationMs: number;
  providerId: string;
  modelId: string | null;
  modelVersion: string | null;
}

export interface AiSoundJobPublic {
  jobId: string;
  projectId: string;
  status: AiSoundJobLifecycle;
  progress: number;
  stageMessage: string;
  createdAt: string;
  updatedAt: string;
  audioAssetId?: string | null;
  error?: string | null;
  errorCode?: string | null;
  spec?: MusicGenerationSpec;
  providerId?: string | null;
}

export interface AiSoundGenerateInput {
  projectId: string;
  mode?: MusicGenerationMode;
  mood?: MusicMood;
  energy?: MusicEnergyLevel;
  tempo?: MusicTempoPreference;
  durationSeconds?: number;
  instrumental?: boolean;
  styleProfileId?: string | null;
  referenceAudioAssetIds?: string[];
  userNotes?: string | null;
  titleHint?: string;
}

export class AiSoundError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
    this.name = "AiSoundError";
  }
}

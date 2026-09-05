/**
 * STEP 2C — Audio Timing Intelligence contract.
 * Analysis only — does not cut video or snap scenes yet.
 */

export const AUDIO_INTELLIGENCE_VERSION = "audio-intelligence-v1";

export type AudioAnalysisLifecycle =
  | "QUEUED"
  | "LOADING"
  | "DECODING"
  | "ANALYZING"
  | "DETECTING_BEATS"
  | "ANALYZING_ENERGY"
  | "ANALYZING_STRUCTURE"
  | "FINALIZING"
  | "READY"
  | "FAILED"
  | "INVALID_AUDIO"
  | "NO_AUDIO_STREAM"
  | "ANALYSIS_TIMEOUT"
  | "NOT_SELECTED"
  | "PENDING";

export type BeatStrengthClass = "weak" | "normal" | "strong" | "accent";

export type EnergyTransitionType = "ENERGY_RISE" | "ENERGY_DROP" | "ENERGY_PEAK" | "ENERGY_STABLE";

export type AudioSectionLabel =
  | "INTRO"
  | "BUILD"
  | "MAIN"
  | "DROP"
  | "BREAK"
  | "CHORUS"
  | "OUTRO"
  | "SECTION_1"
  | "SECTION_2"
  | "SECTION_3"
  | "SECTION_4"
  | "SECTION_5"
  | "SILENCE"
  | "INSUFFICIENT";

/** Future video timing modes — foundation only; STEP 2C does not force sync. */
export type VideoTimingAlignmentMode =
  | "FREE_TIMING"
  | "BEAT_ALIGNED"
  | "STRONG_BEAT_ALIGNED"
  | "DOWNBEAT_ALIGNED";

export interface AudioBeatEvent {
  /** Seconds from audio start */
  time: number;
  /** 0–1 normalized onset strength */
  strength: number;
  strengthClass: BeatStrengthClass;
  confidence: number;
  type?: "beat" | "downbeat";
  barIndex?: number;
  beatInBar?: number;
}

export interface AudioEnergyWindow {
  start: number;
  end: number;
  energy: number;
  trend?: "low" | "rising" | "high" | "falling" | "stable";
}

export interface AudioEnergyTransition {
  time: number;
  type: EnergyTransitionType;
  fromEnergy: number;
  toEnergy: number;
}

export interface AudioSection {
  label: AudioSectionLabel;
  start: number;
  end: number;
  energy: number;
  beatDensity: number;
  confidence: number;
}

export interface AudioBeatDensityWindow {
  start: number;
  end: number;
  beatsPerSecond: number;
  density: "sparse" | "normal" | "dense";
}

export interface TempoAnalysis {
  bpm: number | null;
  primaryBpm: number | null;
  alternativeBpm: number | null;
  confidence: number;
  method: string;
  status: "available" | "unavailable" | "low_confidence" | "insufficient_duration";
  tempoRange?: { min: number; max: number };
}

export interface TechnicalAudioAnalysis {
  durationSec: number;
  sampleRate: number;
  channels: number;
  codec: string | null;
  bitrate: number | null;
  format: string | null;
  silent: boolean;
  insufficientDuration: boolean;
}

/**
 * Immutable base analysis owned by the Audio Asset (keyed by contentHash).
 */
export interface AudioTimingIntelligence {
  audioAssetId: string;
  contentHash: string;
  analysisVersion: typeof AUDIO_INTELLIGENCE_VERSION;
  status: AudioAnalysisLifecycle;
  analyzedAt: string;
  analysisDurationMs: number;
  technical: TechnicalAudioAnalysis;
  tempo: TempoAnalysis;
  duration: number;
  bpm: number | null;
  bpmConfidence: number;
  beats: AudioBeatEvent[];
  strongBeats: AudioBeatEvent[];
  downbeats: AudioBeatEvent[];
  energyTimeline: AudioEnergyWindow[];
  energyTransitions: AudioEnergyTransition[];
  sections: AudioSection[];
  beatDensity: AudioBeatDensityWindow[];
  meanEnergy: number;
  message?: string;
  failureReason?: string;
}

export interface AudioAnalysisJobPublic {
  jobId: string;
  audioAssetId: string;
  contentHash: string;
  status: AudioAnalysisLifecycle;
  progress: number;
  stageMessage: string;
  createdAt: string;
  updatedAt: string;
  result?: AudioTimingIntelligence | null;
  error?: string | null;
}

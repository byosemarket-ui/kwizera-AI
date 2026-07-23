/**
 * KWIZERA AI STUDIO — Audio Enhancement & Restoration Engine types (Step 10H)
 */

export enum AudioEnhancementPlatform {
  Website = "website",
  Mobile = "mobile",
  Podcast = "podcast",
  Audiobook = "audiobook",
  YouTube = "youtube",
  TikTok = "tiktok",
  Instagram = "instagram",
  Television = "television",
  Radio = "radio",
}

export enum AudioEnhancementType {
  Voice = "voice",
  Music = "music",
  SoundEffects = "sound-effects",
  Ambient = "ambient",
  VideoAudio = "video-audio",
  Mixed = "mixed",
}

export enum AudioInputCategory {
  VoiceAudio = "voice-audio",
  MusicAudio = "music-audio",
  SoundEffects = "sound-effects",
  AmbientAudio = "ambient-audio",
  VideoAudio = "video-audio",
}

export enum EnhancementTechnique {
  NoiseReduction = "noise-reduction",
  VoiceEnhancement = "voice-enhancement",
  MusicEnhancement = "music-enhancement",
  BassEnhancement = "bass-enhancement",
  TrebleEnhancement = "treble-enhancement",
  StereoEnhancement = "stereo-enhancement",
  DynamicRangeOptimization = "dynamic-range-optimization",
  LoudnessNormalization = "loudness-normalization",
}

export enum RestorationTechnique {
  ClickRemoval = "click-removal",
  PopRemoval = "pop-removal",
  HumRemoval = "hum-removal",
  HissRemoval = "hiss-removal",
  EchoReduction = "echo-reduction",
  DistortionReduction = "distortion-reduction",
  ClippingRecovery = "clipping-recovery",
  MissingAudioReconstruction = "missing-audio-reconstruction",
  OldRecordingRestoration = "old-recording-restoration",
}

export enum EnhancementInputType {
  VoiceAudio = "voice-audio",
  MusicAudio = "music-audio",
  SoundEffects = "sound-effects",
  AmbientAudio = "ambient-audio",
  VideoAudio = "video-audio",
  AudioMetadata = "audio-metadata",
  BrandGuidelines = "brand-guidelines",
  KnowledgeRecord = "knowledge-record",
}

export interface AudioEnhancementProfile {
  enhancementPlanId: string;
  projectId: string;
  audioAssetId: string;
  brandId: string;
  campaignId?: string;
  platform: AudioEnhancementPlatform;
  enhancementType: AudioEnhancementType;
  version: number;
}

export interface AudioQualityAnalysis {
  sampleRate: number;
  bitDepth: number;
  loudnessLufs: number;
  dynamicRangeDb: number;
  signalToNoiseRatioDb: number;
  backgroundNoiseLevel: string;
  echoLevel: string;
  reverbLevel: string;
  humDetected: boolean;
  clicksDetected: boolean;
  popsDetected: boolean;
  distortionDetected: boolean;
  clippingDetected: boolean;
  silenceGaps: number;
  defects: string[];
  audioCategory: AudioInputCategory;
  durationSec: number;
  keywords: string[];
}

export interface EnhancementPlan {
  techniques: EnhancementTechnique[];
  primaryTechnique: string;
  layerDetails: Record<string, string>;
  targetLoudnessLufs: number;
  processingChain: string[];
}

export interface RestorationPlan {
  techniques: RestorationTechnique[];
  primaryTechnique: string;
  defectTargets: Record<string, string>;
  recoveryNotes: string[];
  severityLevel: string;
}

export interface VoiceImprovementPlan {
  speechClarity: string;
  pronunciationClarity: string;
  breathControl: string;
  deEsserPlanning: string;
  plosiveReduction: string;
  sibilanceControl: string;
}

export interface MusicImprovementPlan {
  instrumentSeparation: string;
  harmonyPreservation: string;
  frequencyBalancing: string;
  stereoWidth: string;
  tonalBalance: string;
  musicalDetailRecovery: string;
}

export interface AudioSyncPlan {
  videoSync: string;
  timelineAlignment: string;
  delayCorrectionMs: number;
  lipSyncMetadata: string;
  multiTrackAlignment: string[];
  syncNotes: string[];
}

export interface OutputPreparationPlan {
  platform: AudioEnhancementPlatform;
  formatNotes: string[];
  loudnessTarget: string;
  deliveryNotes: string[];
}

export interface ProductionEnhancementInstructions {
  renderNotes: string[];
  clarityGuidance: string[];
  restorationGuidance: string[];
  exportPreparation: string[];
  qualityTargets: string[];
}

export interface AudioEnhancementScores {
  audioClarityScore: number;
  restorationScore: number;
  noiseReductionScore: number;
  synchronizationScore: number;
  brandConsistencyScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface AudioEnhancementRelationships {
  enhancementPlans: string[];
  voicePlans: string[];
  musicPlans: string[];
  ambientPlans: string[];
  soundPlans: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  videos: string[];
  knowledgeRecords: string[];
}

export interface AudioEnhancementGenerationInput {
  audioPrompt?: string;
  audioAssetId?: string;
  audioRef?: string;
  voiceAudioRef?: string;
  musicAudioRef?: string;
  soundEffectsRef?: string;
  ambientAudioRef?: string;
  videoAudioRef?: string;
  videoId?: string;
  audioMetadata?: Record<string, unknown>;
  productId?: string;
  projectId?: string;
  campaignId?: string;
  brandId?: string;
  brandName?: string;
  brandGuidelines?: string;
  platform?: AudioEnhancementPlatform;
  enhancementType?: AudioEnhancementType;
  audioCategory?: AudioInputCategory;
  durationSec?: number;
  voicePlanIds?: string[];
  musicPlanIds?: string[];
  ambientPlanIds?: string[];
  soundPlanIds?: string[];
  knowledgeRecordIds?: string[];
  inputTypes?: EnhancementInputType[];
}

export interface AudioEnhancementGenerationRecord {
  enhancementPlanId: string;
  profile: AudioEnhancementProfile;
  audioQualityAnalysis: AudioQualityAnalysis;
  enhancementPlan: EnhancementPlan;
  restorationPlan: RestorationPlan;
  voiceImprovementPlan: VoiceImprovementPlan;
  musicImprovementPlan: MusicImprovementPlan;
  syncPlan: AudioSyncPlan;
  outputPreparation: OutputPreparationPlan;
  productionInstructions: ProductionEnhancementInstructions;
  blueprintId?: string;
  scores: AudioEnhancementScores;
  relationships: AudioEnhancementRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface AudioEnhancementGenerationResult {
  success: boolean;
  record?: AudioEnhancementGenerationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface AudioEnhancementSearchQuery {
  enhancementPlanId?: string;
  productId?: string;
  brandId?: string;
  enhancementType?: AudioEnhancementType;
  audioCategory?: AudioInputCategory;
  platform?: AudioEnhancementPlatform;
  restoration?: string;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface AudioEnhancementGenerationEngineStatusReport {
  engineStatus: string;
  audioAnalysisStatus: string;
  enhancementPlanningStatus: string;
  restorationPlanningStatus: string;
  voiceImprovementStatus: string;
  musicImprovementStatus: string;
  syncPreparationStatus: string;
  enhancementPlansGenerated: number;
  averageAudioClarityScore: number;
  averageProductionReadinessScore: number;
  performance: {
    averageGenerationMs: number;
    averageSearchMs: number;
    averageBlueprintMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class AudioEnhancementRestorationEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AudioEnhancementRestorationEngineError";
  }
}

export const ALL_ENHANCEMENT_PLATFORMS: AudioEnhancementPlatform[] = [
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

export const ENHANCEMENT_TECHNIQUES: EnhancementTechnique[] = Object.values(EnhancementTechnique);
export const RESTORATION_TECHNIQUES: RestorationTechnique[] = Object.values(RestorationTechnique);

export const PLATFORM_ENHANCEMENT_CONFIG: Record<
  AudioEnhancementPlatform,
  { targetLufs: number; formatNotes: string; deliveryPriority: string }
> = {
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

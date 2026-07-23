/**
 * KWIZERA AI STUDIO — Audio Rendering Preparation Engine types (Step 10K)
 */

export enum AudioRenderPlatform {
  Website = "website",
  Mobile = "mobile",
  Podcast = "podcast",
  Audiobook = "audiobook",
  YouTube = "youtube",
  TikTok = "tiktok",
  Instagram = "instagram",
  Television = "television",
  Radio = "radio",
  Film = "film",
}

export enum AudioRenderValidationStage {
  TextToSpeech = "text-to-speech",
  SpeechToSpeech = "speech-to-speech",
  VoiceCloning = "voice-cloning",
  MusicGeneration = "music-generation",
  SoundEffectsGeneration = "sound-effects-generation",
  AmbientAudioGeneration = "ambient-audio-generation",
  AudioEnhancement = "audio-enhancement",
  AudioRestoration = "audio-restoration",
  AudioMixing = "audio-mixing",
  AudioMastering = "audio-mastering",
  ProductionPlans = "production-plans",
}

export enum AudioRenderTrackCheck {
  TrackHierarchy = "track-hierarchy",
  TrackOrder = "track-order",
  TrackGroups = "track-groups",
  BusRouting = "bus-routing",
  SendRouting = "send-routing",
  Automation = "automation",
  MuteSoloStatus = "mute-solo-status",
}

export enum AudioRenderTimelineCheck {
  TimelineAlignment = "timeline-alignment",
  CuePoints = "cue-points",
  TrackPosition = "track-position",
  FadeIn = "fade-in",
  FadeOut = "fade-out",
  Crossfade = "crossfade",
  LoopIntegrity = "loop-integrity",
}

export enum AudioRenderAssetType {
  VoiceTrack = "voice-track",
  MusicTrack = "music-track",
  AmbientTrack = "ambient-track",
  SoundEffect = "sound-effect",
  AudioPreset = "audio-preset",
  Metadata = "metadata",
  BrandAsset = "brand-asset",
  SessionTemplate = "session-template",
}

export enum AudioRenderChannelLayout {
  Mono = "mono",
  Stereo = "stereo",
  Surround = "surround",
}

export enum AudioRenderCodec {
  Wav = "wav",
  Mp3 = "mp3",
  Flac = "flac",
  Aac = "aac",
  Ogg = "ogg",
  Aiff = "aiff",
}

export interface AudioRenderPlanProfile {
  audioRenderPlanId: string;
  projectId: string;
  productionId: string;
  audioId: string;
  platform: AudioRenderPlatform;
  renderVersion: number;
}

export interface AudioRenderValidationEntry {
  stage: AudioRenderValidationStage;
  validated: boolean;
  moduleId: string;
  status: string;
  notes: string[];
}

export interface AudioRenderTrackValidationEntry {
  check: AudioRenderTrackCheck;
  validated: boolean;
  trackCount: number;
  notes: string[];
}

export interface AudioRenderTimelineValidationEntry {
  check: AudioRenderTimelineCheck;
  validated: boolean;
  cueCount: number;
  notes: string[];
}

export interface AudioRenderAssetValidationEntry {
  assetType: AudioRenderAssetType;
  assetId: string;
  validated: boolean;
  source: string;
  notes: string[];
}

export interface AudioRenderTrackEntry {
  trackId: string;
  name: string;
  order: number;
  group: string;
  bus: string;
  send: string;
  automation: boolean;
  muted: boolean;
  solo: boolean;
}

export interface AudioRenderTimelineEntry {
  cueId: string;
  trackId: string;
  positionMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  crossfadeMs: number;
  loop: boolean;
}

export interface AudioRenderSettingsPlan {
  sampleRate: number;
  bitDepth: number;
  channelLayout: AudioRenderChannelLayout;
  mono: boolean;
  stereo: boolean;
  surround: boolean;
  loudnessTarget: number;
  dynamicRange: string;
  codec: AudioRenderCodec;
  compressionStrategy: string;
  outputQuality: number;
  instructions: string[];
}

export interface AudioRenderOutputProfileEntry {
  platform: AudioRenderPlatform;
  sampleRate: number;
  bitDepth: number;
  channelLayout: AudioRenderChannelLayout;
  codec: AudioRenderCodec;
  loudnessTarget: number;
  rules: string[];
}

export interface AudioRenderResourcePlanningPlan {
  cpuAllocation: string;
  gpuAllocation: string;
  ramAllocation: string;
  storageAllocation: string;
  cacheAllocation: string;
  temporaryFiles: string[];
  renderQueue: string[];
  parallelRenderingPreparation: boolean;
  notes: string[];
}

export interface AudioRenderJobPlan {
  jobId: string;
  renderPlanId: string;
  priority: number;
  status: string;
  platform: AudioRenderPlatform;
  estimatedResources: string;
}

export interface AudioRenderRecoveryPlan {
  recoveryId: string;
  checkpoints: string[];
  resumeSteps: string[];
  rollbackSteps: string[];
  automaticRecovery: boolean;
  failureDetection: string[];
}

export interface AudioRenderScores {
  renderReadinessScore: number;
  assetQualityScore: number;
  trackIntegrityScore: number;
  timelineIntegrityScore: number;
  performanceScore: number;
  platformCompatibilityScore: number;
  aiConfidenceScore: number;
}

export interface AudioRenderRelationships {
  audioPlans: string[];
  productionPlans: string[];
  renderPlans: string[];
  voicePlans: string[];
  musicPlans: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  knowledgeRecords: string[];
}

export interface AudioRenderInput {
  productId?: string;
  projectId?: string;
  productionId?: string;
  audioId?: string;
  audioPlanId?: string;
  brandId?: string;
  brandName?: string;
  campaignId?: string;
  platform?: AudioRenderPlatform;
  renderPrompt?: string;
  sessionId?: string;
  voicePlanIds?: string[];
  musicPlanIds?: string[];
  knowledgeRecordIds?: string[];
  validateTracks?: boolean;
  validateTimeline?: boolean;
  validateAssets?: boolean;
  planResources?: boolean;
  prepareOutputProfiles?: boolean;
  generateRenderJobs?: boolean;
}

export interface AudioRenderRecord {
  audioRenderPlanId: string;
  profile: AudioRenderPlanProfile;
  renderValidation: AudioRenderValidationEntry[];
  trackValidation: AudioRenderTrackValidationEntry[];
  timelineValidation: AudioRenderTimelineValidationEntry[];
  assetValidation: AudioRenderAssetValidationEntry[];
  trackStructure: AudioRenderTrackEntry[];
  timelineStructure: AudioRenderTimelineEntry[];
  renderSettings: AudioRenderSettingsPlan;
  outputProfiles: AudioRenderOutputProfileEntry[];
  resourcePlanning: AudioRenderResourcePlanningPlan;
  renderJobs: AudioRenderJobPlan[];
  recoveryPlan: AudioRenderRecoveryPlan;
  blueprintId?: string;
  scores: AudioRenderScores;
  relationships: AudioRenderRelationships;
  recommendations: string[];
  validated: boolean;
  renderReady: boolean;
  productionReady: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface AudioRenderResult {
  success: boolean;
  record?: AudioRenderRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface AudioRenderSearchQuery {
  audioRenderPlanId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: AudioRenderPlatform;
  codec?: AudioRenderCodec;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface AudioRenderEngineStatusReport {
  engineStatus: string;
  renderValidationStatus: string;
  trackValidationStatus: string;
  timelineValidationStatus: string;
  resourcePlanningStatus: string;
  renderPlansGenerated: number;
  averageRenderReadinessScore: number;
  averageTrackIntegrityScore: number;
  performance: {
    averageGenerationMs: number;
    averageSearchMs: number;
    averagePlanningMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class AudioRenderEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AudioRenderEngineError";
  }
}

export const ALL_AUDIO_RENDER_PLATFORMS: AudioRenderPlatform[] = Object.values(AudioRenderPlatform);
export const ALL_AUDIO_RENDER_VALIDATION_STAGES: AudioRenderValidationStage[] = Object.values(AudioRenderValidationStage);
export const ALL_AUDIO_RENDER_TRACK_CHECKS: AudioRenderTrackCheck[] = Object.values(AudioRenderTrackCheck);
export const ALL_AUDIO_RENDER_TIMELINE_CHECKS: AudioRenderTimelineCheck[] = Object.values(AudioRenderTimelineCheck);
export const ALL_AUDIO_RENDER_ASSET_TYPES: AudioRenderAssetType[] = Object.values(AudioRenderAssetType);

export const AUDIO_RENDER_VALIDATION_MODULE_MAP: Record<AudioRenderValidationStage, string> = {
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

export const AUDIO_RENDER_PLATFORM_CONFIG: Record<
  AudioRenderPlatform,
  {
    sampleRate: number;
    bitDepth: number;
    channelLayout: AudioRenderChannelLayout;
    loudnessTarget: number;
    dynamicRange: string;
    codec: AudioRenderCodec;
    compressionStrategy: string;
    outputQuality: number;
  }
> = {
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

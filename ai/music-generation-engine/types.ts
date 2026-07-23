/**
 * KWIZERA AI STUDIO — Music Generation Engine types (Step 10E)
 */

export enum MusicPlatform {
  Website = "website",
  Mobile = "mobile",
  YouTube = "youtube",
  TikTok = "tiktok",
  Instagram = "instagram",
  Facebook = "facebook",
  Television = "television",
  Radio = "radio",
}

export enum MusicGenre {
  Cinematic = "cinematic",
  Corporate = "corporate",
  Commercial = "commercial",
  Pop = "pop",
  Rock = "rock",
  HipHop = "hip-hop",
  Jazz = "jazz",
  Classical = "classical",
  Gospel = "gospel",
  Afrobeat = "afrobeat",
  EDM = "edm",
  Ambient = "ambient",
  LoFi = "lo-fi",
  Orchestral = "orchestral",
}

export enum MusicMood {
  Happy = "happy",
  Calm = "calm",
  Emotional = "emotional",
  Inspirational = "inspirational",
  Epic = "epic",
  Romantic = "romantic",
  Serious = "serious",
  Dramatic = "dramatic",
  Energetic = "energetic",
  Relaxing = "relaxing",
}

export enum MusicInputType {
  MusicPrompt = "music-prompt",
  VideoInformation = "video-information",
  ImageInformation = "image-information",
  BrandGuidelines = "brand-guidelines",
  Campaign = "campaign",
  KnowledgeRecord = "knowledge-record",
}

export enum SyncTarget {
  Video = "video",
  Animation = "animation",
  Advertisement = "advertisement",
  Podcast = "podcast",
  Presentation = "presentation",
  SocialMedia = "social-media",
  Game = "game",
  Film = "film",
}

export enum LoopType {
  Seamless = "seamless",
  Intro = "intro",
  Ambient = "ambient",
  Background = "background",
  Ending = "ending",
}

export interface MusicProfile {
  musicPlanId: string;
  projectId: string;
  brandId: string;
  campaignId?: string;
  platform: MusicPlatform;
  genre: MusicGenre;
  mood: MusicMood;
  version: number;
}

export interface MusicAnalysis {
  mood: MusicMood;
  genre: MusicGenre;
  tempo: string;
  key: string;
  scale: string;
  timeSignature: string;
  energy: string;
  emotion: string;
  durationSec: number;
  intendedAudience: string;
  keywords: string[];
}

export interface CompositionPlan {
  melodyStructure: string[];
  harmonyStructure: string[];
  rhythmStructure: string[];
  chordProgression: string[];
  intro: string;
  verse: string;
  chorus: string;
  bridge: string;
  outro: string;
}

export interface ArrangementPlan {
  piano: string;
  guitar: string;
  strings: string;
  brass: string;
  woodwinds: string;
  percussion: string;
  synth: string;
  bass: string;
  choir: string;
  electronicInstruments: string;
  activeInstruments: string[];
}

export interface MoodPlan {
  primaryMood: MusicMood;
  secondaryMood?: MusicMood;
  emotionalArc: string[];
  intensityCurve: string;
  moodTransitions: string[];
  brandMoodAlignment: string;
}

export interface SyncPreparationPlan {
  syncTarget: SyncTarget;
  hitPoints: string[];
  tempoSync: string;
  fadeIn: string;
  fadeOut: string;
  duckingNotes: string[];
  platformNotes: string[];
}

export interface LoopPlan {
  loopType: LoopType;
  seamless: boolean;
  loopDurationSec: number;
  crossfadeMs: number;
  loopPoints: string[];
  notes: string[];
}

export interface ProductionMusicInstructions {
  renderNotes: string[];
  mixGuidance: string[];
  exportPreparation: string[];
  qualityTargets: string[];
  orchestrationNotes: string[];
}

export interface MusicGenerationScores {
  compositionScore: number;
  harmonyScore: number;
  rhythmScore: number;
  emotionalScore: number;
  brandConsistencyScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface MusicGenerationRelationships {
  musicPlans: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  videos: string[];
  images: string[];
  voicePlans: string[];
  knowledgeRecords: string[];
}

export interface MusicGenerationInput {
  musicPrompt?: string;
  videoId?: string;
  videoRef?: string;
  imageId?: string;
  imageRef?: string;
  productId?: string;
  projectId?: string;
  campaignId?: string;
  brandId?: string;
  brandName?: string;
  brandGuidelines?: string;
  platform?: MusicPlatform;
  genre?: MusicGenre;
  mood?: MusicMood;
  syncTarget?: SyncTarget;
  loopType?: LoopType;
  durationSec?: number;
  tempo?: string;
  key?: string;
  knowledgeRecordIds?: string[];
  voicePlanIds?: string[];
  inputTypes?: MusicInputType[];
}

export interface MusicGenerationRecord {
  musicPlanId: string;
  profile: MusicProfile;
  musicAnalysis: MusicAnalysis;
  compositionPlan: CompositionPlan;
  arrangementPlan: ArrangementPlan;
  moodPlan: MoodPlan;
  syncPreparation: SyncPreparationPlan;
  loopPlan: LoopPlan;
  productionInstructions: ProductionMusicInstructions;
  blueprintId?: string;
  scores: MusicGenerationScores;
  relationships: MusicGenerationRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface MusicGenerationResult {
  success: boolean;
  record?: MusicGenerationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface MusicSearchQuery {
  musicPlanId?: string;
  productId?: string;
  brandId?: string;
  genre?: MusicGenre;
  mood?: MusicMood;
  platform?: MusicPlatform;
  syncTarget?: SyncTarget;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface MusicGenerationEngineStatusReport {
  engineStatus: string;
  musicAnalysisStatus: string;
  compositionPlanningStatus: string;
  arrangementPlanningStatus: string;
  moodPlanningStatus: string;
  syncPreparationStatus: string;
  loopPlanningStatus: string;
  musicPlansGenerated: number;
  averageCompositionScore: number;
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

export class MusicGenerationEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "MusicGenerationEngineError";
  }
}

export const ALL_MUSIC_PLATFORMS: MusicPlatform[] = [
  MusicPlatform.Website,
  MusicPlatform.Mobile,
  MusicPlatform.YouTube,
  MusicPlatform.TikTok,
  MusicPlatform.Instagram,
  MusicPlatform.Facebook,
  MusicPlatform.Television,
  MusicPlatform.Radio,
];

export const SUPPORTED_MUSIC_GENRES: MusicGenre[] = [
  MusicGenre.Cinematic,
  MusicGenre.Corporate,
  MusicGenre.Commercial,
  MusicGenre.Pop,
  MusicGenre.Rock,
  MusicGenre.HipHop,
  MusicGenre.Jazz,
  MusicGenre.Classical,
  MusicGenre.Gospel,
  MusicGenre.Afrobeat,
  MusicGenre.EDM,
  MusicGenre.Ambient,
  MusicGenre.LoFi,
  MusicGenre.Orchestral,
];

export const SUPPORTED_MUSIC_MOODS: MusicMood[] = [
  MusicMood.Happy,
  MusicMood.Calm,
  MusicMood.Emotional,
  MusicMood.Inspirational,
  MusicMood.Epic,
  MusicMood.Romantic,
  MusicMood.Serious,
  MusicMood.Dramatic,
  MusicMood.Energetic,
  MusicMood.Relaxing,
];

export const PLATFORM_MUSIC_CONFIG: Record<
  MusicPlatform,
  { maxDurationSec: number; loudnessTarget: string; formatNotes: string }
> = {
  [MusicPlatform.Website]: { maxDurationSec: 180, loudnessTarget: "-14 LUFS", formatNotes: "Background-friendly mix" },
  [MusicPlatform.Mobile]: { maxDurationSec: 120, loudnessTarget: "-14 LUFS", formatNotes: "Compressed for mobile playback" },
  [MusicPlatform.YouTube]: { maxDurationSec: 600, loudnessTarget: "-14 LUFS", formatNotes: "Full dynamic range for video" },
  [MusicPlatform.TikTok]: { maxDurationSec: 60, loudnessTarget: "-12 LUFS", formatNotes: "Hook-forward, punchy mix" },
  [MusicPlatform.Instagram]: { maxDurationSec: 90, loudnessTarget: "-13 LUFS", formatNotes: "Trend-aware arrangement" },
  [MusicPlatform.Facebook]: { maxDurationSec: 120, loudnessTarget: "-14 LUFS", formatNotes: "Auto-play optimized" },
  [MusicPlatform.Television]: { maxDurationSec: 30, loudnessTarget: "-24 LUFS", formatNotes: "Broadcast loudness standard" },
  [MusicPlatform.Radio]: { maxDurationSec: 180, loudnessTarget: "-16 LUFS", formatNotes: "Radio-ready mastering" },
};

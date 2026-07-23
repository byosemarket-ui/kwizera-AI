/**
 * KWIZERA AI STUDIO — Speech-to-Speech Generation Engine types (Step 10C)
 */

import { EmotionType, VoiceType } from "../text-to-speech-generation-engine/types.js";

export enum S2sPlatform {
  Website = "website",
  MobileApp = "mobile-app",
  YouTube = "youtube",
  TikTok = "tiktok",
  Instagram = "instagram",
  Facebook = "facebook",
  Television = "television",
}

export enum S2sLanguage {
  English = "en",
  Kinyarwanda = "rw",
  French = "fr",
  Swahili = "sw",
}

export enum S2sInputType {
  SourceAudio = "source-audio",
  VoiceProfile = "voice-profile",
  BrandGuidelines = "brand-guidelines",
  Campaign = "campaign",
  StyleReference = "style-reference",
  KnowledgeRecord = "knowledge-record",
}

export enum S2sOutputUseCase {
  VideoNarration = "video-narration",
  Audiobook = "audiobook",
  Podcast = "podcast",
  Advertisement = "advertisement",
  CustomerSupport = "customer-support",
  Elearning = "e-learning",
  Accessibility = "accessibility",
}

export enum AccentType {
  American = "american",
  British = "british",
  African = "african",
  French = "french",
  Neutral = "neutral",
  Regional = "regional",
}

export interface SpeechTransformationProfile {
  transformationId: string;
  sourceAudioId: string;
  projectId: string;
  sourceVoiceId: string;
  targetVoiceId: string;
  brandId: string;
  campaignId?: string;
  language: S2sLanguage;
  platform: S2sPlatform;
  outputUseCase: S2sOutputUseCase;
  version: number;
}

export interface SpeakerSegment {
  segmentId: string;
  startMs: number;
  endMs: number;
  speakerLabel: string;
  transcriptHint: string;
  emotion: EmotionType;
}

export interface SpeechAnalysis {
  language: S2sLanguage;
  speakerSegments: SpeakerSegment[];
  pronunciationNotes: string;
  accent: AccentType;
  speakingRate: string;
  pitchRange: string;
  intonationPattern: string;
  rhythmPattern: string;
  detectedEmotion: EmotionType;
  backgroundNoiseLevel: string;
  silenceRatio: number;
  audioQualityScore: number;
  durationMs: number;
  keywords: string[];
  properNames: string[];
  technicalTerms: string[];
}

export interface VoiceTransformationPlan {
  sourceVoiceType: VoiceType;
  targetVoiceType: VoiceType;
  voiceMapping: Record<string, string>;
  accentAdaptation: string;
  pitchAdaptation: string;
  speakingRateAdaptation: string;
  toneAdaptation: string;
  emotionAdaptation: string;
  genderNeutralPlanning: string;
  characterVoicePlanning: string;
  brandVoiceAlignment: string;
}

export interface EmotionPreservationPlan {
  sourceEmotion: EmotionType;
  targetEmotion: EmotionType;
  preservationScore: number;
  emotionMapping: Record<EmotionType, EmotionType>;
  intensityPreservation: number;
  emotionalArc: string[];
  sceneEmotionNotes: string[];
}

export interface PronunciationAdaptationPlan {
  phonemeMapping: Record<string, string>;
  pronunciationDictionary: Record<string, string>;
  namePreservation: Record<string, string>;
  technicalVocabulary: Record<string, string>;
  acronymHandling: Record<string, string>;
  numberReadingRules: string[];
  dateReadingRules: string[];
}

export interface TimingPreservationPlan {
  speechTiming: string;
  naturalPauses: string[];
  rhythmPreservation: string;
  sentenceBoundaries: string[];
  breathPlanning: string[];
  segmentTiming: { segmentId: string; startMs: number; endMs: number }[];
}

export interface PlatformSpeechOptimization {
  platform: S2sPlatform;
  speakingRate: string;
  pauseProfile: string;
  emphasisStyle: string;
  formatNotes: string[];
  optimizationNotes: string[];
}

export interface ProductionTransformationInstructions {
  renderNotes: string[];
  segmentGuidance: string[];
  timingGuidance: string[];
  exportPreparation: string[];
  qualityTargets: string[];
}

export interface SpeechToSpeechScores {
  transformationQualityScore: number;
  pronunciationScore: number;
  emotionPreservationScore: number;
  timingPreservationScore: number;
  brandConsistencyScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface SpeechToSpeechRelationships {
  sourceAudio: string[];
  targetVoices: string[];
  voiceProfiles: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  videos: string[];
  knowledgeRecords: string[];
  productionPlans: string[];
}

export interface SpeechToSpeechGenerationInput {
  sourceAudioId?: string;
  sourceAudioRef?: string;
  transcriptHint?: string;
  sourceVoiceId?: string;
  targetVoiceId?: string;
  sourceVoiceType?: VoiceType;
  targetVoiceType?: VoiceType;
  sourceAccent?: AccentType;
  productId?: string;
  projectId?: string;
  campaignId?: string;
  brandId?: string;
  brandName?: string;
  brandGuidelines?: string;
  platform?: S2sPlatform;
  language?: S2sLanguage;
  outputUseCase?: S2sOutputUseCase;
  sourceEmotion?: EmotionType;
  durationMs?: number;
  styleReferenceIds?: string[];
  knowledgeRecordIds?: string[];
  generatePlatformOptimizations?: boolean;
  inputTypes?: S2sInputType[];
}

export interface SpeechToSpeechGenerationRecord {
  transformationId: string;
  profile: SpeechTransformationProfile;
  speechAnalysis: SpeechAnalysis;
  voiceTransformation: VoiceTransformationPlan;
  emotionPreservation: EmotionPreservationPlan;
  pronunciationAdaptation: PronunciationAdaptationPlan;
  timingPreservation: TimingPreservationPlan;
  platformOptimizations: PlatformSpeechOptimization[];
  productionInstructions: ProductionTransformationInstructions;
  blueprintId?: string;
  scores: SpeechToSpeechScores;
  relationships: SpeechToSpeechRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface SpeechToSpeechGenerationResult {
  success: boolean;
  record?: SpeechToSpeechGenerationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface SpeechToSpeechSearchQuery {
  transformationId?: string;
  sourceAudioId?: string;
  sourceVoiceId?: string;
  targetVoiceId?: string;
  productId?: string;
  brandId?: string;
  language?: S2sLanguage;
  platform?: S2sPlatform;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface SpeechToSpeechGenerationEngineStatusReport {
  engineStatus: string;
  speechAnalysisStatus: string;
  voiceTransformationStatus: string;
  emotionPreservationStatus: string;
  timingPreservationStatus: string;
  platformOptimizationStatus: string;
  transformationsGenerated: number;
  averageTransformationQualityScore: number;
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

export class SpeechToSpeechGenerationEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "SpeechToSpeechGenerationEngineError";
  }
}

export const ALL_S2S_PLATFORMS: S2sPlatform[] = [
  S2sPlatform.Website,
  S2sPlatform.MobileApp,
  S2sPlatform.YouTube,
  S2sPlatform.TikTok,
  S2sPlatform.Instagram,
  S2sPlatform.Facebook,
  S2sPlatform.Television,
];

export const SUPPORTED_S2S_LANGUAGES: S2sLanguage[] = [
  S2sLanguage.English,
  S2sLanguage.Kinyarwanda,
  S2sLanguage.French,
  S2sLanguage.Swahili,
];

export const PLATFORM_S2S_CONFIG: Record<
  S2sPlatform,
  { speakingRate: string; pauseProfile: string; maxDurationSec: number }
> = {
  [S2sPlatform.Website]: { speakingRate: "150 wpm", pauseProfile: "moderate", maxDurationSec: 120 },
  [S2sPlatform.MobileApp]: { speakingRate: "145 wpm", pauseProfile: "short", maxDurationSec: 60 },
  [S2sPlatform.YouTube]: { speakingRate: "155 wpm", pauseProfile: "narrative", maxDurationSec: 600 },
  [S2sPlatform.TikTok]: { speakingRate: "165 wpm", pauseProfile: "minimal", maxDurationSec: 60 },
  [S2sPlatform.Instagram]: { speakingRate: "160 wpm", pauseProfile: "conversational", maxDurationSec: 90 },
  [S2sPlatform.Facebook]: { speakingRate: "150 wpm", pauseProfile: "moderate", maxDurationSec: 120 },
  [S2sPlatform.Television]: { speakingRate: "140 wpm", pauseProfile: "broadcast", maxDurationSec: 30 },
};

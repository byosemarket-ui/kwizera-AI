/**
 * KWIZERA AI STUDIO — Audio Planning Engine types (Step 5J)
 */

import type { CreativePlatform } from "../creative-direction-engine/types.js";
import type { MarketingObjective } from "../marketing-strategy-intelligence-engine/types.js";

export type AudioPlanningPlatform = CreativePlatform;

export interface AudioPlanningProfile {
  audioPlanId: string;
  projectId: string;
  storyboardId: string;
  scriptPlanId: string;
  visualPlanId: string;
  product: string;
  brand: string;
  campaignGoal: MarketingObjective;
  platform: AudioPlanningPlatform;
  audioVersion: number;
  language: string;
}

export interface SceneAudioPlan {
  sceneNumber: number;
  scenePurpose: string;
  plannedVoiceOver: string;
  plannedNarrationTiming: string;
  plannedMusicLevel: string;
  plannedSfx: string[];
  transitionAudio: string;
  emotionalPacing: string;
}

export interface VoicePlanning {
  voiceStyle: string;
  voiceGenderPreference: string;
  voiceAgeStyle: string;
  speakingSpeed: string;
  speakingTone: string;
  emotionalTone: string;
  pronunciationRules: string[];
  emphasisPoints: string[];
  pauseTiming: Record<number, string>;
  readingDuration: Record<number, string>;
}

export interface MusicPlanning {
  musicStyle: string;
  musicMood: string;
  musicEnergy: string;
  introMusic: string;
  backgroundMusic: string;
  endingMusic: string;
  fadeIn: string;
  fadeOut: string;
  volumeStrategy: string;
}

export interface SoundEffectPlanning {
  transitionSounds: string[];
  productSounds: string[];
  clickSounds: string[];
  whooshSounds: string[];
  impactSounds: string[];
  ambientSounds: string[];
  notificationSounds: string[];
  sceneEffects: Record<number, string[]>;
}

export interface AudioSynchronization {
  voiceTiming: Record<number, string>;
  musicTiming: Record<number, string>;
  subtitleTiming: Record<number, string>;
  sceneTiming: Record<number, string>;
  transitionTiming: Record<number, string>;
  ctaTiming: string;
}

export interface EmotionalFlowPlanning {
  excitement: string;
  trust: string;
  curiosity: string;
  urgency: string;
  luxury: string;
  professionalism: string;
  happiness: string;
  inspiration: string;
}

export interface PlatformAudioRules {
  platform: AudioPlanningPlatform;
  maxVoiceDuration: string;
  musicVolumeGuidance: string;
  sfxDensity: string;
  voiceOverRequired: boolean;
  pacingGuidance: string;
}

export interface AudioPlanningScores {
  audioPlanningScore: number;
  voicePlanningScore: number;
  musicPlanningScore: number;
  synchronizationScore: number;
  brandConsistencyScore: number;
  aiConfidenceScore: number;
}

export interface AudioPlanningRelationships {
  storyboards: string[];
  scriptPlans: string[];
  visualPlans: string[];
  creativeDirections: string[];
  marketingStrategies: string[];
  brands: string[];
  languages: string[];
  productionPlans: string[];
  knowledgeRecords: string[];
}

export interface AudioPlanningInput {
  productId: string;
  audioPlanId?: string;
  storyboardId?: string;
  scriptPlanId?: string;
  visualPlanId?: string;
  projectId?: string;
  language?: string;
}

export interface AudioPlanningRecord {
  audioPlanId: string;
  productId: string;
  projectId: string;
  storyboardId: string;
  scriptPlanId: string;
  visualPlanId: string;
  creativeId: string;
  strategyId: string;
  profile: AudioPlanningProfile;
  sceneAudioPlans: SceneAudioPlan[];
  voicePlanning: VoicePlanning;
  musicPlanning: MusicPlanning;
  soundEffectPlanning: SoundEffectPlanning;
  synchronization: AudioSynchronization;
  emotionalFlow: EmotionalFlowPlanning;
  platformRules: PlatformAudioRules;
  scores: AudioPlanningScores;
  relationships: AudioPlanningRelationships;
  validated: boolean;
  productionReady: boolean;
  createdAt: string;
  lastUpdated: string;
  version: number;
}

export interface AudioPlanningResult {
  success: boolean;
  record?: AudioPlanningRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface AudioPlanningSearchQuery {
  audioPlanId?: string;
  storyboardId?: string;
  scriptPlanId?: string;
  visualPlanId?: string;
  brand?: string;
  language?: string;
  platform?: AudioPlanningPlatform;
  campaignGoal?: MarketingObjective;
  voiceStyle?: string;
  musicStyle?: string;
  mood?: string;
  productId?: string;
  text?: string;
  limit?: number;
}

export interface AudioPlanningEngineStatusReport {
  engineStatus: string;
  audioPlanningStatus: string;
  voicePlanningStatus: string;
  musicPlanningStatus: string;
  synchronizationStatus: string;
  audioPlansPrepared: number;
  averageAudioPlanningScore: number;
  averageSynchronizationScore: number;
  performance: {
    averagePlanningMs: number;
    averageSearchMs: number;
    averageRelationshipMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class AudioPlanningEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "AudioPlanningEngineError";
  }
}

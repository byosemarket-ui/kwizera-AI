export type VoicePersona =
  | "male"
  | "female"
  | "youth"
  | "luxury"
  | "friendly"
  | "professional";

export type MusicStyle =
  | "luxury"
  | "modern"
  | "fashion"
  | "technology"
  | "beauty"
  | "sports"
  | "corporate"
  | "minimal";

export type SoundEffectKind =
  | "product-reveal"
  | "camera-movement"
  | "rotation"
  | "zoom"
  | "transition"
  | "click"
  | "swipe"
  | "ambient"
  | "premium";

export type NarrationSection =
  | "opening-hook"
  | "product-introduction"
  | "feature-presentation"
  | "benefits"
  | "price"
  | "promotional-offer"
  | "call-to-action"
  | "closing";

export interface VoiceSelection {
  persona: VoicePersona;
  language: string;
  why: string;
  brandMatch: string;
  audienceMatch: string;
}

export interface MusicSelection {
  style: MusicStyle;
  why: string;
  emotion: string;
  licensedOrGenerated: "generated-offline";
}

export interface SceneNarrationCue {
  sceneNumber: number;
  section: NarrationSection;
  text: string;
  startSeconds: number;
  endSeconds: number;
  language: string;
}

export interface SoundEffectCue {
  kind: SoundEffectKind;
  sceneNumber: number;
  atSeconds: number;
  why: string;
}

export interface MixSettings {
  voiceVolume: number;
  musicVolume: number;
  effectsVolume: number;
  equalization: string;
  noiseReduction: boolean;
  dynamicRange: string;
  stereoBalance: string;
  musicBelowNarration: true;
}

export interface SyncReport {
  voiceSynced: boolean;
  musicSynced: boolean;
  effectsSynced: boolean;
  sceneTimingSynced: boolean;
  cameraSynced: boolean;
  transitionSynced: boolean;
  problems: string[];
  score: number;
}

export interface ProductAudioAsset {
  assetId: string;
  kind: "voice" | "music" | "effects" | "mix" | "subtitles";
  fileName: string;
  relativePath: string;
  mimeType: "audio/wav" | "text/vtt";
  durationSeconds: number;
  sampleRate?: number;
}

export interface ProductAudioGenerationQuality {
  voiceQualityScore: number;
  narrationQualityScore: number;
  musicQualityScore: number;
  soundEffectsScore: number;
  synchronizationScore: number;
  mixBalanceScore: number;
  languageQualityScore: number;
  overall: number;
  issues: string[];
  repairs: string[];
}

export interface ProductAudioGenerationResult {
  generationId: string;
  projectId: string;
  productId: string;
  videoGenerationId: string;
  storyboardId: string;
  orchestrationId: string;
  voice: VoiceSelection;
  music: MusicSelection;
  narrationCues: SceneNarrationCue[];
  soundEffects: SoundEffectCue[];
  mix: MixSettings;
  sync: SyncReport;
  assets: ProductAudioAsset[];
  improvementRecommendations: string[];
  quality: ProductAudioGenerationQuality;
  creativePipelineStep: 8;
  renderingDeferred: true;
  copyrightSafe: true;
  createdAt: string;
  updatedAt: string;
  cached: boolean;
}

export interface AiMeProductAudioGenerationAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainVoiceSelection: boolean;
  canExplainMusicSelection: boolean;
  canExplainSoundEffects: boolean;
  canRecommendBetterAudio: boolean;
  canDetectAudioQualityProblems: boolean;
  renderingDeferred: true;
  summary: string;
}

export interface ProductAudioGenerationExplainResult {
  generationId: string;
  productName: string;
  summary: string;
  voiceExplanation: string;
  musicExplanation: string;
  effectExplanations: Array<{ sceneNumber: number; kind: SoundEffectKind; why: string }>;
  syncProblems: string[];
  improvementRecommendations: string[];
  readyForRendering: boolean;
}

export interface ProductAudioGenerationHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface ProductAudioGenerationStore {
  generations: ProductAudioGenerationResult[];
  cache: Record<string, string>;
  history: Array<{ id: string; at: string; projectId: string; event: string; detail: string }>;
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}

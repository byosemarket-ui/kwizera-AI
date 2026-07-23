/**
 * KWIZERA AI STUDIO — AI Audio Generation Foundation types (Step 10A)
 */

export enum AudioGenerationLifecycleState {
  Initializing = "initializing",
  Loading = "loading",
  Ready = "ready",
  Preparing = "preparing",
  Generating = "generating",
  Validating = "validating",
  Optimizing = "optimizing",
  RenderPreparation = "render-preparation",
  ExportPreparation = "export-preparation",
  Archiving = "archiving",
  Recovering = "recovering",
  Closing = "closing",
  Closed = "closed",
}

export enum AudioGenerationCategory {
  TextToSpeech = "text-to-speech-generation",
  SpeechToSpeech = "speech-to-speech-generation",
  VoiceCloning = "voice-cloning-generation",
  MusicGeneration = "music-generation",
  SoundEffectsGeneration = "sound-effects-generation",
  AmbientAudioGeneration = "ambient-audio-generation",
  AudioEnhancement = "audio-enhancement-generation",
  AudioRestoration = "audio-restoration-generation",
  AudioMixing = "audio-mixing-generation",
  AudioMastering = "audio-mastering-generation",
  AudioProduction = "audio-production",
  RenderingPlanning = "audio-rendering-planning",
  AudioQualityValidation = "audio-quality-validation",
  ExportPlanning = "audio-export-planning",
  BatchGeneration = "batch-audio-generation",
  DistributedGeneration = "distributed-audio-generation",
  CloudGeneration = "cloud-audio-generation-preparation",
  RealTimePreparation = "real-time-audio-preparation",
  GenerationHealthMonitoring = "audio-generation-health-monitor",
}

export enum AudioGenerationModuleStatus {
  Prepared = "prepared",
  Registered = "registered",
  Active = "active",
  Disabled = "disabled",
  Validating = "validating",
  Recovering = "recovering",
  Failed = "failed",
}

export enum AudioGenerationHealthLevel {
  Excellent = "excellent",
  Good = "good",
  Warning = "warning",
  Critical = "critical",
  Failed = "failed",
}

export enum AudioGenerationSource {
  MemoryEngine = "memory-engine",
  KnowledgeEngine = "knowledge-engine",
  ProductIntelligenceEngine = "product-intelligence-engine",
  ImageIntelligenceEngine = "image-intelligence-engine",
  VideoIntelligenceEngine = "video-intelligence-engine",
  VideoGenerationEngine = "video-generation-engine",
  ImageGenerationEngine = "image-generation-engine",
  ProductionPlan = "production-plan",
  Prompt = "prompt",
  Template = "template",
  Voice = "voice",
  UserInput = "user-input",
  System = "system",
  Manual = "manual",
}

export enum AudioGenerationVerificationStatus {
  Unverified = "unverified",
  Pending = "pending",
  Verified = "verified",
  Rejected = "rejected",
  Archived = "archived",
}

export enum AudioGenerationAccessPermission {
  Read = "read",
  Write = "write",
  Update = "update",
  Delete = "delete",
  Validate = "validate",
  Admin = "admin",
}

export enum AudioGenerationAccessOperation {
  Read = "read",
  Write = "write",
  Update = "update",
  Delete = "delete",
  Validate = "validate",
  Query = "query",
}

export enum AudioGenerationAssetType {
  Prompt = "prompt",
  Voice = "voice",
  VoiceProfile = "voice-profile",
  AudioTrack = "audio-track",
  Music = "music",
  SoundEffect = "sound-effect",
  AmbientSound = "ambient-sound",
  Narration = "narration",
  Podcast = "podcast",
  Template = "template",
  Preset = "preset",
  RenderProfile = "render-profile",
}

export enum AudioGenerationBlueprintStage {
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
  AudioProduction = "audio-production",
  RenderingPlanning = "rendering-planning",
  AudioQualityValidation = "audio-quality-validation",
  ExportPlanning = "export-planning",
}

export enum AudioGenerationWorkflowActionType {
  Generate = "generate",
  Edit = "edit",
  Replace = "replace",
  Sync = "sync",
  Plan = "plan",
  Validate = "validate",
  Optimize = "optimize",
  Restore = "restore",
  Rollback = "rollback",
}

export enum AudioGenerationPlatformTarget {
  Podcast = "podcast",
  Spotify = "spotify",
  YouTube = "youtube",
  Social = "social",
  Broadcast = "broadcast",
  Elearning = "elearning",
  Custom = "custom",
}

export enum AudioGenerationQualityTarget {
  Low = "low",
  Standard = "standard",
  High = "high",
  Studio = "studio",
  Broadcast = "broadcast",
  Custom = "custom",
}

export interface AudioGenerationVersionEntry {
  version: number;
  timestamp: string;
  changeSummary: string;
  source: AudioGenerationSource;
}

export interface AudioGenerationQualityMetadata {
  qualityScore: number;
  confidenceScore: number;
  verificationStatus: AudioGenerationVerificationStatus;
  source: AudioGenerationSource;
  sourceRef?: string;
  versionHistory: AudioGenerationVersionEntry[];
  relationshipLinks: string[];
  healthStatus: AudioGenerationHealthLevel;
  lastValidated?: string;
}

export interface AudioGenerationModuleRegistration {
  moduleId: string;
  moduleName: string;
  version: string;
  status: AudioGenerationModuleStatus;
  dependencies: string[];
  qualityScore: number;
  confidenceScore: number;
  healthStatus: AudioGenerationHealthLevel;
  createdAt: string;
  lastUpdated: string;
  accessPermissions: AudioGenerationAccessPermission[];
  category: AudioGenerationCategory;
  storageLocation: string;
  implemented: boolean;
}

export interface AudioGenerationRegistrySnapshot {
  foundationVersion: string;
  storageRoot: string;
  lastUpdated: string;
  modules: AudioGenerationModuleRegistration[];
}

export interface AudioGenerationIntegrityResult {
  verified: boolean;
  checkedPaths: number;
  issues: string[];
  checksumVerified: boolean;
  blueprintIntegrity: boolean;
  timestamp: string;
}

export interface AudioGenerationAccessRequest {
  requesterId: string;
  category: AudioGenerationCategory;
  operation: AudioGenerationAccessOperation;
  resourceId?: string;
}

export interface AudioGenerationAccessResult {
  granted: boolean;
  message: string;
  durationMs: number;
}

export interface AudioGenerationValidationResult {
  valid: boolean;
  qualityScore: number;
  confidenceScore: number;
  verificationStatus: AudioGenerationVerificationStatus;
  issues: string[];
  recommendations: string[];
  durationMs: number;
}

export interface AudioGenerationIntegrationStatus {
  aiCore: boolean;
  memoryEngine: boolean;
  knowledgeEngine: boolean;
  productIntelligenceEngine: boolean;
  imageIntelligenceEngine: boolean;
  videoIntelligenceEngine: boolean;
  videoGenerationEngine: boolean;
  imageGenerationEngine: boolean;
  decisionEngine: boolean;
  reasoningEngine: boolean;
  planningEngine: boolean;
  workflowEngine: boolean;
  stateManager: boolean;
  recoveryEngine: boolean;
  healthMonitor: boolean;
  readyCount: number;
  totalCount: number;
}

export interface AudioGenerationHealthReport {
  level: AudioGenerationHealthLevel;
  score: number;
  availability: boolean;
  storageIntegrity: boolean;
  registryHealth: boolean;
  assetRegistryHealth: boolean;
  blueprintHealth: boolean;
  workflowHealth: boolean;
  qualityValidation: boolean;
  integrationReady: boolean;
  readPerformanceMs: number;
  writePerformanceMs: number;
  issues: string[];
  timestamp: string;
}

export interface AudioGenerationAssetRegistration {
  assetId: string;
  assetType: AudioGenerationAssetType;
  assetName: string;
  projectId: string;
  trackId?: string;
  voiceId?: string;
  promptId?: string;
  qualityScore: number;
  confidenceScore: number;
  verificationStatus: AudioGenerationVerificationStatus;
  source: AudioGenerationSource;
  sourceRef?: string;
  relationshipLinks: string[];
  relatedProducts: string[];
  relatedBrands: string[];
  relatedCampaigns: string[];
  relatedKnowledge: string[];
  relatedProductionPlans: string[];
  relatedImages: string[];
  relatedVideos: string[];
  relatedPrompts: string[];
  version: number;
  createdAt: string;
  lastUpdated: string;
}

export interface AudioGenerationBlueprintStageEntry {
  stage: AudioGenerationBlueprintStage;
  enabled: boolean;
  order: number;
  dependencies: AudioGenerationBlueprintStage[];
  qualityScore: number;
  readinessScore: number;
  lastUpdated: string;
}

export interface AudioGenerationBlueprint {
  blueprintId: string;
  projectId: string;
  name: string;
  stages: AudioGenerationBlueprintStageEntry[];
  multiProject: boolean;
  multiTrack: boolean;
  multiLanguage: boolean;
  multiSpeaker: boolean;
  multiPlatform: boolean;
  multiQuality: boolean;
  batchGeneration: boolean;
  distributedGeneration: boolean;
  cloudGenerationPrepared: boolean;
  realTimePrepared: boolean;
  integrityVerified: boolean;
  version: number;
  createdAt: string;
  lastUpdated: string;
}

export interface AudioGenerationProjectRegistration {
  projectId: string;
  projectName: string;
  description: string;
  brand?: string;
  product?: string;
  campaign?: string;
  languages: string[];
  platforms: AudioGenerationPlatformTarget[];
  qualities: AudioGenerationQualityTarget[];
  speakers: string[];
  trackIds: string[];
  voiceIds: string[];
  promptIds: string[];
  blueprintId?: string;
  productionPlanId?: string;
  qualityScore: number;
  confidenceScore: number;
  version: number;
  createdAt: string;
  lastUpdated: string;
}

export interface AudioGenerationWorkflowEditEntry {
  editId: string;
  projectId: string;
  trackId?: string;
  actionType: AudioGenerationWorkflowActionType;
  summary: string;
  beforeStateRef: string;
  afterStateRef: string;
  reversible: boolean;
  timestamp: string;
  version: number;
}

export interface AudioGenerationWorkflowState {
  projectId: string;
  trackId?: string;
  originalPreserved: boolean;
  currentVersion: number;
  undoStack: string[];
  redoStack: string[];
  editHistory: AudioGenerationWorkflowEditEntry[];
  lastUpdated: string;
}

export interface AudioGenerationFoundationStatusReport {
  foundationStatus: string;
  lifecycleState: AudioGenerationLifecycleState;
  registryStatus: string;
  storageStatus: string;
  persistenceStatus: string;
  integrityStatus: string;
  healthLevel: AudioGenerationHealthLevel;
  integrationStatus: AudioGenerationIntegrationStatus;
  registeredModules: number;
  preparedModules: number;
  assetCount: number;
  projectCount: number;
  blueprintCount: number;
  performance: {
    startupMs: number;
    averageReadMs: number;
    averageWriteMs: number;
    averageValidationMs: number;
    totalAccessRequests: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class AudioGenerationFoundationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AudioGenerationFoundationError";
  }
}

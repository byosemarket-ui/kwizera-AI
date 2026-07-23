/**
 * KWIZERA AI STUDIO — Timeline Intelligence Engine types (Step 7E)
 */

export enum TimelineVariant {
  Main = "main",
  ShortVersion = "short-version",
  Trailer = "trailer",
  Teaser = "teaser",
  SocialMedia = "social-media",
  PlatformSpecific = "platform-specific",
}

export enum TrackType {
  Video = "video",
  Audio = "audio",
  Voice = "voice",
  Subtitle = "subtitle",
  Caption = "caption",
  Effects = "effects",
  MotionGraphics = "motion-graphics",
  Overlay = "overlay",
  Adjustment = "adjustment",
}

export interface TimelineSection {
  sectionId: string;
  title: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  sceneIds: string[];
  order: number;
}

export interface TimelineDependency {
  dependencyId: string;
  sourceId: string;
  targetId: string;
  type: "scene" | "shot" | "track" | "sync";
  description: string;
}

export interface TimelineHierarchy {
  levels: string[];
  rootTimelineId: string;
  childTimelineIds: string[];
}

export interface SceneSequenceEntry {
  sceneId: string;
  order: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  priority: string;
  dependencies: string[];
  relatedSceneIds: string[];
}

export interface ShotSequenceEntry {
  shotId: string;
  sceneId: string;
  order: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  shotGroup: string;
  relatedShotIds: string[];
}

export interface TimelineTrack {
  trackId: string;
  trackType: TrackType;
  label: string;
  startMs: number;
  endMs: number;
  muted: boolean;
  locked: boolean;
  clipCount: number;
}

export interface SynchronizationState {
  audioSyncScore: number;
  subtitleSyncScore: number;
  voiceSyncScore: number;
  transitionSyncScore: number;
  animationSyncScore: number;
  effectSyncScore: number;
  overallSyncScore: number;
}

export interface TimelineOptimization {
  timelineFlowScore: number;
  storyFlowScore: number;
  sceneContinuityScore: number;
  trackAlignmentScore: number;
  resourceUsageScore: number;
  renderingEfficiencyScore: number;
  recommendations: string[];
}

export interface VariantTimeline {
  variant: TimelineVariant;
  timelineId: string;
  lengthMs: number;
  sectionCount: number;
  sceneCount: number;
  shotCount: number;
  platform?: string;
}

export interface TimelineIntelligenceIndexes {
  timelineIndexIds: string[];
  sceneIndexIds: string[];
  shotIndexIds: string[];
  trackIndexIds: string[];
  syncIndexIds: string[];
}

export interface TimelineQualityScores {
  timelineQualityScore: number;
  synchronizationScore: number;
  storyFlowScore: number;
  productionReadinessScore: number;
  performanceScore: number;
  aiConfidenceScore: number;
}

export interface TimelineRecommendation {
  category: "structure" | "sync" | "track" | "optimization" | "production";
  suggestion: string;
  priority: "low" | "medium" | "high";
  reason: string;
}

export interface TimelineRelationships {
  relatedVideos: string[];
  relatedScenes: string[];
  relatedShots: string[];
  relatedProducts: string[];
  relatedBrands: string[];
  relatedCampaigns: string[];
  relatedStoryboards: string[];
  relatedScripts: string[];
  relatedAudioPlans: string[];
  relatedProductionPlans: string[];
  relatedKnowledge: string[];
  relatedMemory: string[];
  relatedProjects: string[];
}

export interface TimelineIntelligenceInput {
  videoId: string;
  projectId?: string;
  variants?: TimelineVariant[];
  platform?: string;
  relatedStoryboards?: string[];
  relatedScripts?: string[];
  relatedAudioPlans?: string[];
  relatedProductionPlans?: string[];
  relatedKnowledge?: string[];
  relatedProjects?: string[];
}

export interface TimelineIntelligenceRecord {
  videoId: string;
  intelligenceId: string;
  analysisId: string;
  detectionId: string;
  understandingId?: string;
  timelineId: string;
  timelineVersion: number;
  timelineLengthMs: number;
  sections: TimelineSection[];
  hierarchy: TimelineHierarchy;
  dependencies: TimelineDependency[];
  sceneSequence: SceneSequenceEntry[];
  shotSequence: ShotSequenceEntry[];
  tracks: TimelineTrack[];
  synchronization: SynchronizationState;
  optimization: TimelineOptimization;
  variants: VariantTimeline[];
  indexes: TimelineIntelligenceIndexes;
  scores: TimelineQualityScores;
  relationships: TimelineRelationships;
  recommendations: TimelineRecommendation[];
  editingReadiness: number;
  renderingReadiness: number;
  keywords: string[];
  validated: boolean;
  analyzedAt: string;
  lastUpdated: string;
  version: number;
}

export interface TimelineIntelligenceResult {
  success: boolean;
  record?: TimelineIntelligenceRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface TimelineIntelligenceSearchQuery {
  videoId?: string;
  timelineId?: string;
  sceneId?: string;
  shotId?: string;
  trackType?: TrackType;
  variant?: TimelineVariant;
  product?: string;
  brand?: string;
  campaign?: string;
  keywords?: string[];
  text?: string;
  limit?: number;
}

export interface TimelineIntelligenceEngineStatusReport {
  engineStatus: string;
  timelineStructureStatus: string;
  sceneSequencingStatus: string;
  shotSequencingStatus: string;
  trackManagementStatus: string;
  synchronizationStatus: string;
  multiTimelineStatus: string;
  indexingStatus: string;
  relationshipStatus: string;
  knowledgeBridgeStatus: string;
  memoryBridgeStatus: string;
  productIntelligenceBridgeStatus: string;
  imageIntelligenceBridgeStatus: string;
  timelinesProcessed: number;
  totalVariants: number;
  averageTimelineQualityScore: number;
  averageSynchronizationScore: number;
  performance: {
    averageAnalysisMs: number;
    averageSearchMs: number;
    averageIndexingMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class TimelineIntelligenceEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "TimelineIntelligenceEngineError";
  }
}

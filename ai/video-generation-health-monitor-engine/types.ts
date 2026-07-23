/**
 * KWIZERA AI STUDIO — Video Generation Health Monitor Engine types (Step 8N)
 */

export enum VideoGenerationHealthScoreLevel {
  Excellent = "excellent",
  Good = "good",
  Warning = "warning",
  Critical = "critical",
  Failed = "failed",
}

export enum MonitoredVideoGenerationModule {
  VideoGenerationFoundation = "video-generation-foundation",
  StoryboardGeneration = "story-generation-engine",
  SceneGeneration = "scene-generation-engine",
  CameraDirector = "camera-planning-generation-engine",
  MotionGeneration = "motion-planning-generation-engine",
  Animation = "animation-planning-generation-engine",
  VisualEffects = "visual-effects-planning-generation-engine",
  AudioSynchronization = "audio-sync-generation-engine",
  MarketingVideo = "marketing-video-generation-engine",
  VideoProduction = "video-production-generation-engine",
  RenderingPreparation = "rendering-planning-generation-engine",
  VideoQualityValidation = "video-quality-validation-engine",
  VideoGenerationOptimization = "video-generation-optimization-engine",
  RenderQueuePreparation = "render-queue-preparation",
  AssetRegistry = "asset-registry",
  TimelineRegistry = "timeline-registry",
  ProductionRegistry = "production-registry",
}

export enum VideoGenerationWarningType {
  StoryboardProblems = "storyboard-problems",
  SceneProblems = "scene-problems",
  CameraProblems = "camera-problems",
  MotionProblems = "motion-problems",
  AnimationProblems = "animation-problems",
  VisualEffectsProblems = "visual-effects-problems",
  AudioProblems = "audio-problems",
  MarketingProblems = "marketing-problems",
  ProductionProblems = "production-problems",
  RenderPreparationProblems = "render-preparation-problems",
  ValidationProblems = "validation-problems",
  RelationshipFailure = "relationship-failure",
  BrokenDependencies = "broken-dependencies",
  HighResourceUsage = "high-resource-usage",
  SearchFailure = "search-failure",
  DatabaseProblems = "database-problems",
  RegistryProblems = "registry-problems",
  CacheProblems = "cache-problems",
}

export interface MonitoredVideoGenerationModuleHealthScore {
  module: MonitoredVideoGenerationModule;
  score: number;
  level: VideoGenerationHealthScoreLevel;
  available: boolean;
  issues: string[];
}

export interface VideoGenerationHealthWarning {
  type: VideoGenerationWarningType;
  severity: VideoGenerationHealthScoreLevel;
  message: string;
  module: MonitoredVideoGenerationModule;
  recommendation: string;
}

export interface VideoGenerationHealthCheckResult {
  checkId: string;
  timestamp: string;
  overallScore: number;
  overallLevel: VideoGenerationHealthScoreLevel;
  moduleScores: MonitoredVideoGenerationModuleHealthScore[];
  warnings: VideoGenerationHealthWarning[];
  errors: string[];
  repairs: string[];
  recommendations: string[];
  performance: {
    checkDurationMs: number;
    searchPerformanceMs: number;
    planningPerformanceMs: number;
    validationPerformanceMs: number;
    optimizationPerformanceMs: number;
    diskUsageMb: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
    gpuUsagePercent: number;
  };
  storyboardIntegrity: boolean;
  sceneIntegrity: boolean;
  timelineIntegrity: boolean;
  cameraIntegrity: boolean;
  motionIntegrity: boolean;
  animationIntegrity: boolean;
  visualEffectsIntegrity: boolean;
  audioIntegrity: boolean;
  marketingIntegrity: boolean;
  productionIntegrity: boolean;
  renderPreparationIntegrity: boolean;
  validationIntegrity: boolean;
  assetIntegrity: boolean;
  registryIntegrity: boolean;
  optimizationStatus: boolean;
  recoveryNotified: boolean;
}

export interface VideoGenerationAuditResult {
  auditId: string;
  timestamp: string;
  storyboardQuality: boolean;
  sceneQuality: boolean;
  cameraQuality: boolean;
  motionQuality: boolean;
  animationQuality: boolean;
  visualEffectsQuality: boolean;
  audioQuality: boolean;
  brandConsistency: boolean;
  dependencyValidation: boolean;
  optimizationStatus: boolean;
  valid: boolean;
  durationMs: number;
}

export interface VideoGenerationHealthHistoryEntry {
  checkId: string;
  timestamp: string;
  module: string;
  healthScore: number;
  level: VideoGenerationHealthScoreLevel;
  warnings: string[];
  errors: string[];
  repairs: string[];
  recommendations: string[];
  performanceMs: number;
}

export interface VideoGenerationTrendAnalysis {
  direction: "improving" | "stable" | "declining";
  averageScore: number;
  scoreChange: number;
  warningTrend: number;
  prediction: string;
}

export interface VideoGenerationAutoRepairResult {
  attempted: boolean;
  success: boolean;
  repairs: string[];
  validated: boolean;
}

export interface VideoGenerationHealthMonitorStatusReport {
  engineStatus: string;
  overallVideoGenerationHealth: string;
  moduleHealthSummary: string;
  storyboardHealth: string;
  productionHealth: string;
  renderReadinessHealth: string;
  totalChecks: number;
  totalWarnings: number;
  performance: {
    averageCheckMs: number;
    lastCheckMs: number;
    averageDiskMb: number;
  };
  trendAnalysis: VideoGenerationTrendAnalysis;
  recommendations: string[];
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class VideoGenerationHealthMonitorEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "VideoGenerationHealthMonitorEngineError";
  }
}

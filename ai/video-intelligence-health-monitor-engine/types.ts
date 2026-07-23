/**

 * KWIZERA AI STUDIO — Video Intelligence Health Monitor Engine types (Step 7N)

 */



export enum VideoIntelligenceHealthScoreLevel {

  Excellent = "excellent",

  Good = "good",

  Warning = "warning",

  Critical = "critical",

  Failed = "failed",

}



export enum MonitoredVideoIntelligenceModule {

  VideoIntelligenceFoundation = "video-intelligence-foundation",

  VideoAnalysis = "video-analysis-engine",

  VideoUnderstanding = "video-understanding-engine",

  SceneDetection = "scene-intelligence",

  TimelineIntelligence = "timeline-intelligence",

  CameraMovement = "camera-intelligence",

  MotionIntelligence = "motion-intelligence",

  VideoStyle = "video-style-intelligence",

  VideoEnhancementPlanning = "video-enhancement-planning",

  CreativeVideoIntelligence = "creative-video-intelligence",

  ProductionVideoPlanning = "production-video-planning",

  VideoQualityPrediction = "video-quality-prediction",

  VideoIntelligenceOptimization = "video-intelligence-optimization",

  VideoIntelligenceRegistry = "video-intelligence-registry",

  VideoIntelligenceDatabase = "video-intelligence-database",

  TimelineDatabase = "timeline-database",

  VideoRelationships = "video-relationships",

  VideoSearch = "video-search",

  VideoCache = "video-cache",

}



export enum VideoIntelligenceWarningType {

  VideoAnalysisFailure = "video-analysis-failure",

  SceneDetectionFailure = "scene-detection-failure",

  TimelineProblems = "timeline-problems",

  MotionProblems = "motion-problems",

  CameraProblems = "camera-problems",

  StyleProblems = "style-problems",

  EnhancementPlanningProblems = "enhancement-planning-problems",

  CreativePlanningProblems = "creative-planning-problems",

  ProductionPlanningProblems = "production-planning-problems",

  RelationshipFailure = "relationship-failure",

  BrokenDependencies = "broken-dependencies",

  HighResourceUsage = "high-resource-usage",

  SearchFailure = "search-failure",

  DatabaseProblems = "database-problems",

  RegistryProblems = "registry-problems",

  CacheProblems = "cache-problems",

}



export interface MonitoredVideoIntelligenceModuleHealthScore {

  module: MonitoredVideoIntelligenceModule;

  score: number;

  level: VideoIntelligenceHealthScoreLevel;

  available: boolean;

  issues: string[];

}



export interface VideoIntelligenceHealthWarning {

  type: VideoIntelligenceWarningType;

  severity: VideoIntelligenceHealthScoreLevel;

  message: string;

  module: MonitoredVideoIntelligenceModule;

  recommendation: string;

}



export interface VideoIntelligenceHealthCheckResult {

  checkId: string;

  timestamp: string;

  overallScore: number;

  overallLevel: VideoIntelligenceHealthScoreLevel;

  moduleScores: MonitoredVideoIntelligenceModuleHealthScore[];

  warnings: VideoIntelligenceHealthWarning[];

  errors: string[];

  repairs: string[];

  recommendations: string[];

  performance: {

    checkDurationMs: number;

    searchPerformanceMs: number;

    planningPerformanceMs: number;

    timelineProcessingMs: number;

    analysisPerformanceMs: number;

    diskUsageMb: number;

    memoryUsageMb: number;

    cpuUsagePercent: number;

    gpuUsagePercent: number;

  };

  videoQualityIntegrity: boolean;

  storytellingIntegrity: boolean;

  timelineIntegrity: boolean;

  sceneIntegrity: boolean;

  relationshipIntegrity: boolean;

  optimizationStatus: boolean;

  qualityPredictionStatus: boolean;

  recoveryNotified: boolean;

}



export interface VideoIntelligenceAuditResult {

  auditId: string;

  timestamp: string;

  videoQuality: boolean;

  storytellingIntegrity: boolean;

  timelineIntegrity: boolean;

  sceneIntegrity: boolean;

  brandConsistency: boolean;

  dependencyValidation: boolean;

  optimizationStatus: boolean;

  qualityPredictionStatus: boolean;

  valid: boolean;

  durationMs: number;

}



export interface VideoIntelligenceHealthHistoryEntry {

  checkId: string;

  timestamp: string;

  module: string;

  healthScore: number;

  level: VideoIntelligenceHealthScoreLevel;

  warnings: string[];

  errors: string[];

  repairs: string[];

  recommendations: string[];

  performanceMs: number;

}



export interface VideoIntelligenceTrendAnalysis {

  direction: "improving" | "stable" | "declining";

  averageScore: number;

  scoreChange: number;

  warningTrend: number;

  prediction: string;

}



export interface VideoIntelligenceAutoRepairResult {

  attempted: boolean;

  success: boolean;

  repairs: string[];

  validated: boolean;

}



export interface VideoIntelligenceHealthMonitorStatusReport {

  engineStatus: string;

  overallVideoIntelligenceHealth: string;

  moduleHealthSummary: string;

  videoQuality: string;

  storytellingHealth: string;

  timelineHealth: string;

  relationshipHealth: string;

  totalChecks: number;

  totalWarnings: number;

  performance: {

    averageCheckMs: number;

    lastCheckMs: number;

    averageDiskMb: number;

  };

  trendAnalysis: VideoIntelligenceTrendAnalysis;

  recommendations: string[];

  knownIssues: string[];

  readinessScore: number;

  timestamp: string;

}



export class VideoIntelligenceHealthMonitorEngineError extends Error {

  constructor(

    message: string,

    public readonly code: string

  ) {

    super(message);

    this.name = "VideoIntelligenceHealthMonitorEngineError";

  }

}



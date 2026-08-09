/** AI Learning Step 5 — Performance Analytics & Production Intelligence types. */

export const PERFORMANCE_ANALYTICS_VERSION = "1.0";

export type AnalyticsSourceModule =
  | "product-intelligence"
  | "product-assets"
  | "scene-planning"
  | "storyboard"
  | "prompt-engine"
  | "ai-model-orchestration"
  | "image-generation"
  | "video-generation"
  | "audio-generation"
  | "rendering"
  | "user-feedback"
  | "ai-self-review";

export type BottleneckKind =
  | "slow-module"
  | "memory-leak"
  | "gpu-bottleneck"
  | "cpu-bottleneck"
  | "storage-bottleneck"
  | "rendering-bottleneck"
  | "workflow-bottleneck";

export type OptimizationTarget =
  | "speed"
  | "quality"
  | "memory-usage"
  | "gpu-usage"
  | "rendering"
  | "workflow"
  | "resource-allocation";

export interface PipelineTimingInput {
  totalProductionMs?: number;
  imageGenerationMs?: number;
  videoGenerationMs?: number;
  audioGenerationMs?: number;
  renderingMs?: number;
  exportMs?: number;
  overallPipelineMs?: number;
}

export interface ResourceSnapshotInput {
  cpuPercent?: number;
  gpuPercent?: number;
  ramMb?: number;
  vramMb?: number;
  storageMb?: number;
  diskSpeedMBps?: number;
  networkMbps?: number;
}

export interface QualityScoresInput {
  imageQuality?: number;
  videoQuality?: number;
  audioQuality?: number;
  storytellingQuality?: number;
  cameraQuality?: number;
  lightingQuality?: number;
  editingQuality?: number;
  renderingQuality?: number;
  marketingQuality?: number;
}

export interface ModelPerformanceInput {
  modelId: string;
  task: string;
  speedScore?: number;
  accuracyScore?: number;
  stabilityScore?: number;
  memoryMb?: number;
  resourceScore?: number;
  failureRate?: number;
  outputQuality?: number;
}

export interface ProductionSessionInput {
  sessionId?: string;
  projectId: string;
  sources: AnalyticsSourceModule[];
  timings: PipelineTimingInput;
  resources: ResourceSnapshotInput;
  quality: QualityScoresInput;
  models?: ModelPerformanceInput[];
  errorCount?: number;
  timestamp?: string;
}

export interface NormalizedPipelineMetrics {
  totalProductionMs: number;
  imageGenerationMs: number;
  videoGenerationMs: number;
  audioGenerationMs: number;
  renderingMs: number;
  exportMs: number;
  overallPipelineMs: number;
}

export interface NormalizedResourceMetrics {
  cpuPercent: number;
  gpuPercent: number;
  ramMb: number;
  vramMb: number;
  storageMb: number;
  diskSpeedMBps: number;
  networkMbps: number;
}

export interface NormalizedQualityScores {
  imageQuality: number;
  videoQuality: number;
  audioQuality: number;
  storytellingQuality: number;
  cameraQuality: number;
  lightingQuality: number;
  editingQuality: number;
  renderingQuality: number;
  marketingQuality: number;
  overallQuality: number;
}

export interface ModelPerformanceRecord {
  modelId: string;
  task: string;
  speedScore: number;
  accuracyScore: number;
  stabilityScore: number;
  memoryMb: number;
  resourceScore: number;
  failureRate: number;
  outputQuality: number;
  compositeScore: number;
}

export interface DetectedBottleneck {
  id: string;
  kind: BottleneckKind;
  severity: "low" | "medium" | "high";
  module: string;
  detail: string;
  metricValue: number;
  threshold: number;
}

export interface OptimizationRecommendation {
  id: string;
  target: OptimizationTarget;
  priority: "low" | "medium" | "high";
  recommendation: string;
  expectedImpact: string;
  relatedBottleneckId?: string;
}

export interface ProductionDashboard {
  productionStatistics: {
    sessionsAnalyzed: number;
    avgPipelineMs: number;
    avgOverallQuality: number;
    totalErrors: number;
  };
  performanceTrends: Array<{ at: string; overallPipelineMs: number }>;
  qualityTrends: Array<{ at: string; overallQuality: number }>;
  errorTrends: Array<{ at: string; errorCount: number }>;
  resourceTrends: Array<{ at: string; cpuPercent: number; gpuPercent: number; ramMb: number }>;
  productivityTrends: Array<{ at: string; sessionsPerWindow: number; avgQuality: number }>;
}

export interface AnalyzedProductionSession {
  id: string;
  projectId: string;
  sources: AnalyticsSourceModule[];
  timings: NormalizedPipelineMetrics;
  resources: NormalizedResourceMetrics;
  quality: NormalizedQualityScores;
  models: ModelPerformanceRecord[];
  bestModelByTask: Record<string, string>;
  bottlenecks: DetectedBottleneck[];
  optimizations: OptimizationRecommendation[];
  errorCount: number;
  analyzedAt: string;
}

export interface PerformanceAnalyticsResult {
  runId: string;
  version: typeof PERFORMANCE_ANALYTICS_VERSION;
  processedAt: string;
  sessions: AnalyzedProductionSession[];
  dashboard: ProductionDashboard;
  bottlenecks: DetectedBottleneck[];
  optimizations: OptimizationRecommendation[];
  bestModels: Record<string, string>;
  issuesFound: string[];
  issuesRepaired: string[];
  historyPreserved: true;
  autonomousLearningDeferred: false;
  summary: string;
}

export interface AiMePerformanceAnalyticsAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainPerformanceIssues: boolean;
  canExplainBottlenecks: boolean;
  canRecommendOptimizations: boolean;
  canCompareProductionSessions: boolean;
  canPredictProductionTime: boolean;
  autonomousLearningDeferred: false;
  summary: string;
}

export interface PerformanceAnalyticsExplainResult {
  sessionId?: string;
  performanceIssues: string;
  bottlenecksExplanation: string;
  optimizations: string[];
  sessionComparison: string;
  predictedProductionTimeMs: number;
  predictedProductionTimeNote: string;
}

export interface PerformanceAnalyticsHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface PerformanceAnalyticsReportData {
  generatedAt: string;
  existingAnalyticsCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  pipelinePerformance: string;
  resourceUsage: string;
  qualityScores: string;
  aiModelPerformance: string;
  bottlenecksFound: string[];
  optimizationsRecommended: string[];
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep6: string[];
}

export interface PerformanceAnalyticsStore {
  sessions: AnalyzedProductionSession[];
  runs: PerformanceAnalyticsResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}

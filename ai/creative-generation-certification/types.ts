export const CREATIVE_GENERATION_PIPELINE_VERSION = "1.0";

export type CertificationCheckStatus = "passed" | "failed" | "blocked" | "skipped";

export interface CertificationCheck {
  id: string;
  label: string;
  status: CertificationCheckStatus;
  detail: string;
  score?: number;
  issues: string[];
}

export type ScenarioProductKind = "shoe" | "bag" | "phone" | "watch";

export interface StageScorecard {
  productIntelligence: CertificationCheck;
  productAssetPreparation: CertificationCheck;
  scenePlanning: CertificationCheck;
  storyboard: CertificationCheck;
  promptEngine: CertificationCheck;
  modelOrchestration: CertificationCheck;
  imageGeneration: CertificationCheck;
  videoGeneration: CertificationCheck;
  audioGeneration: CertificationCheck;
  rendering: CertificationCheck;
  exportDelivery: CertificationCheck;
}

export interface ScenarioCertificationResult {
  scenarioId: string;
  kind: ScenarioProductKind;
  name: string;
  projectId: string;
  passed: boolean;
  expectedOutput: string;
  stageScores: StageScorecard;
  productPreservationScore: number;
  marketingQualityScore: number;
  platformExportCount: number;
  platformsVerified: string[];
  generationTimeMs: number;
  renderingTimeMs: number;
  storageBytesApprox: number;
  issues: string[];
  repairs: string[];
}

export interface ConsistencyCertificationResult {
  noDuplicateModules: CertificationCheck;
  noDuplicateWorkflows: CertificationCheck;
  noDuplicatePrompts: CertificationCheck;
  noBrokenDependencies: CertificationCheck;
  noMissingPipelineStages: CertificationCheck;
  noMissingKnowledgeDomains: CertificationCheck;
}

export interface PerformanceCertificationResult {
  generationTimeMs: number;
  renderingTimeMs: number;
  memoryUsageMb: number;
  cpuUsagePercentApprox: number;
  gpuUsagePercentApprox: number | null;
  storageUsageMb: number;
  pipelineStability: CertificationCheck;
  performanceScore: number;
}

export interface AiMeProductionCapability {
  understandsProducts: boolean;
  analyzesProductImages: boolean;
  preservesProductIdentity: boolean;
  plansScenes: boolean;
  buildsStoryboards: boolean;
  generatesProfessionalPrompts: boolean;
  coordinatesAiModels: boolean;
  producesMarketingVideos: boolean;
  explainsProductionDecisions: boolean;
  score: number;
  summary: string;
}

export interface CreativeGenerationCertificationResult {
  certificationId: string;
  version: typeof CREATIVE_GENERATION_PIPELINE_VERSION;
  certifiedAt: string;
  stages: StageScorecard;
  scenarios: ScenarioCertificationResult[];
  consistency: ConsistencyCertificationResult;
  performance: PerformanceCertificationResult;
  overallCreativeGenerationScore: number;
  productPreservationScore: number;
  marketingQualityScore: number;
  performanceScore: number;
  aiMeProductionCapability: AiMeProductionCapability;
  issuesFound: string[];
  issuesRepaired: string[];
  remainingLimitations: string[];
  blockers: string[];
  productionReady: boolean;
  certificate: string | null;
  creativePipelineStep: 10;
}

export interface AiMeCreativeGenerationCertificationAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canCertifyPipeline: boolean;
  canExplainCertification: boolean;
  canDetectBlockers: boolean;
  canRecommendRepairs: boolean;
  summary: string;
}

export interface CreativeGenerationCertificationExplainResult {
  certificationId: string;
  summary: string;
  productionReady: boolean;
  scenarioSummaries: Array<{ kind: ScenarioProductKind; passed: boolean; detail: string }>;
  blockers: string[];
  remainingLimitations: string[];
  certificate: string | null;
}

export interface CreativeGenerationCertificationHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface CreativeGenerationCertificationStore {
  certifications: CreativeGenerationCertificationResult[];
  history: Array<{ id: string; at: string; event: string; detail: string }>;
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}

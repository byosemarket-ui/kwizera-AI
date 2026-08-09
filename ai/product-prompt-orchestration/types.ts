export type PromptKind =
  | "image"
  | "video"
  | "animation"
  | "camera"
  | "lighting"
  | "background"
  | "audio"
  | "voice"
  | "subtitle"
  | "rendering";

export type ModelRole =
  | "image-generation"
  | "video-generation"
  | "audio-generation"
  | "voice-generation"
  | "background-removal"
  | "upscaling"
  | "rendering";

export interface ScenePromptSet {
  sceneNumber: number;
  sceneId: string;
  prompts: Record<PromptKind, string>;
  promptIds: Record<PromptKind, string>;
  assetId: string;
  sourceImageId: string;
  productName: string;
  optimizationNotes: string[];
  conflicts: string[];
}

export interface ModelSelection {
  taskId: string;
  sceneNumber: number;
  role: ModelRole;
  bestModelId: string;
  backupModelId: string;
  expectedOutput: string;
  requiredInput: string[];
  qualityTarget: string;
  performanceTarget: string;
  whySelected: string;
  swappable: true;
}

export interface ExecutionPlanTask {
  taskId: string;
  sceneNumber: number;
  role: ModelRole;
  modelId: string;
  dependsOn: string[];
  parallelGroup: string;
  order: number;
  failureRecovery: string;
  retryStrategy: string;
}

export interface ExecutionPlan {
  planId: string;
  modelExecutionOrder: string[];
  sceneExecutionOrder: number[];
  parallelTasks: string[];
  dependencies: Array<{ from: string; to: string }>;
  tasks: ExecutionPlanTask[];
  failureRecovery: string;
  retryStrategy: string;
}

export interface ConsistencyLocks {
  productName: string;
  colors: string[];
  logo: string;
  style: string;
  cameraLanguage: string;
  lightingStyle: string;
  brandIdentity: string;
  assetIds: string[];
}

export interface PromptOrchestrationQuality {
  promptGenerationScore: number;
  promptQualityScore: number;
  promptConsistencyScore: number;
  modelSelectionScore: number;
  executionPlanScore: number;
  orchestrationScore: number;
  overall: number;
  issues: string[];
  repairs: string[];
}

export interface ProductPromptOrchestrationResult {
  orchestrationId: string;
  projectId: string;
  productId: string;
  storyboardId: string;
  scenePromptSets: ScenePromptSet[];
  modelSelections: ModelSelection[];
  executionPlan: ExecutionPlan;
  consistency: ConsistencyLocks;
  promptConflicts: string[];
  orchestrationFailures: string[];
  improvementRecommendations: string[];
  quality: PromptOrchestrationQuality;
  creativePipelineStep: 5;
  imageGenerationDeferred: true;
  videoGenerationDeferred: true;
  createdAt: string;
  updatedAt: string;
  cached: boolean;
}

export interface AiMeProductPromptOrchestrationAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainModelSelection: boolean;
  canExplainPrompts: boolean;
  canRecommendPromptImprovements: boolean;
  canDetectPromptConflicts: boolean;
  canDetectOrchestrationFailures: boolean;
  imageGenerationDeferred: true;
  videoGenerationDeferred: true;
  summary: string;
}

export interface ProductPromptOrchestrationExplainResult {
  orchestrationId: string;
  productName: string;
  summary: string;
  modelExplanations: Array<{ taskId: string; why: string }>;
  promptExplanations: Array<{ sceneNumber: number; kind: PromptKind; prompt: string; why: string }>;
  improvementRecommendations: string[];
  promptConflicts: string[];
  orchestrationFailures: string[];
  readyForImageGeneration: boolean;
}

export interface ProductPromptOrchestrationHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface ProductPromptOrchestrationStore {
  orchestrations: ProductPromptOrchestrationResult[];
  cache: Record<string, string>;
  history: Array<{ id: string; at: string; projectId: string; event: string; detail: string }>;
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}

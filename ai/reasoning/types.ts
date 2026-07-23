/**
 * KWIZERA AI STUDIO — AI Reasoning Engine types (Step 2C)
 */

export enum ReasoningType {
  ProductAnalysis = "product-analysis",
  ImageAnalysis = "image-analysis",
  VideoPlanning = "video-planning",
  MarketingStrategy = "marketing-strategy",
  Translation = "translation",
  Branding = "branding",
  WorkflowPlanning = "workflow-planning",
  ExportDecisions = "export-decisions",
  ErrorRecovery = "error-recovery",
  Learning = "learning",
}

export enum ReasoningStep {
  ReceiveTask = 1,
  UnderstandObjective = 2,
  CollectInformation = 3,
  SearchMemory = 4,
  SearchKnowledge = 5,
  AnalyzeContext = 6,
  GenerateApproaches = 7,
  CompareApproaches = 8,
  CalculateConfidence = 9,
  RecommendBest = 10,
  ExplainInternally = 11,
  SendToDecisionEngine = 12,
}

export enum ConfidenceLevel {
  VeryHigh = "very-high",
  High = "high",
  Medium = "medium",
  Low = "low",
  VeryLow = "very-low",
}

export enum ReasoningStatus {
  Pending = "pending",
  InProgress = "in-progress",
  AwaitingInput = "awaiting-input",
  Complete = "complete",
  Failed = "failed",
}

export interface ReasoningRequest {
  taskId: string;
  type: ReasoningType;
  userObjective: string;
  userRequest: string;
  inputs: Record<string, unknown>;
  correlationId?: string;
  errorContext?: ErrorAnalysisInput;
}

export interface ErrorAnalysisInput {
  errorMessage: string;
  errorCode?: string;
  stage?: string;
  context?: Record<string, unknown>;
}

export interface ContextAnalysis {
  userObjective: string;
  productType?: string;
  productQuality?: string;
  brandIdentity?: string;
  availableResources: string[];
  previousProjects: boolean;
  previousLearning: boolean;
  marketingGoal?: string;
  targetAudience?: string;
  systemHealthy: boolean;
  completenessScore: number;
  factors: string[];
}

export interface ReasoningApproach {
  id: string;
  label: string;
  description: string;
  advantages: string[];
  disadvantages: string[];
  estimatedRisk: number;
  suggestedWorkflow?: string;
}

export interface ApproachComparison {
  summary: string;
  rankedApproachIds: string[];
  tradeoffs: Array<{ approachId: string; note: string }>;
}

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  score: number;
  sufficient: boolean;
  factors: string[];
  explanation: string;
}

export interface RiskAssessment {
  overallRisk: "low" | "medium" | "high";
  risks: Array<{ name: string; severity: string; mitigation: string }>;
}

export interface ReasoningRecommendation {
  approachId: string;
  label: string;
  summary: string;
  suggestedWorkflow?: string;
  improvements: string[];
}

export interface ReasoningExplanation {
  summary: string;
  whyBest: string;
  rejectedAlternatives: Array<{ id: string; reason: string }>;
  internalNotes: string[];
}

export interface MissingInformationItem {
  field: string;
  severity: "critical" | "important" | "optional";
  message: string;
}

export interface RecoveryOption {
  id: string;
  label: string;
  description: string;
  safety: "safest" | "moderate" | "aggressive";
}

export interface ErrorAnalysisResult {
  rootCause: string;
  recoveryOptions: RecoveryOption[];
  safestOptionId: string;
  explanation: string;
}

export interface ReasoningRecord {
  reasoningId: string;
  task: string;
  reasoningType: ReasoningType;
  inputs: Record<string, unknown>;
  context: ContextAnalysis;
  alternatives: string[];
  chosenRecommendation: string;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number;
  explanation: ReasoningExplanation;
  executionResult: "pending" | "success" | "failure";
  futureLearningValue: number;
  taskId: string;
  timestamp: string;
}

export interface ReasoningResult {
  reasoningId: string;
  status: ReasoningStatus;
  readyForDecision: boolean;
  stepsCompleted: ReasoningStep[];
  contextAnalysis: ContextAnalysis;
  approaches: ReasoningApproach[];
  comparison: ApproachComparison;
  confidence: ConfidenceAssessment;
  recommendation?: ReasoningRecommendation;
  explanation?: ReasoningExplanation;
  missingInformation: MissingInformationItem[];
  riskAssessment: RiskAssessment;
  errorAnalysis?: ErrorAnalysisResult;
  record: ReasoningRecord;
  durationMs: number;
}

export class ReasoningEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly missingInformation?: MissingInformationItem[]
  ) {
    super(message);
    this.name = "ReasoningEngineError";
  }
}

export interface ReasoningEngineStatusReport {
  reasoningEngineStatus: string;
  reasoningAccuracy: number;
  confidenceQuality: string;
  performance: {
    averageReasoningMs: number;
    totalReasonings: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

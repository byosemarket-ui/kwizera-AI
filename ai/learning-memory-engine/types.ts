/**
 * KWIZERA AI STUDIO — Learning Memory Engine types (Step 3E)
 */

export enum LearningCategory {
  Product = "product-learning",
  Video = "video-learning",
  Image = "image-learning",
  Marketing = "marketing-learning",
  Brand = "brand-learning",
  Workflow = "workflow-learning",
  Decision = "decision-learning",
  Reasoning = "reasoning-learning",
  Language = "language-learning",
  Project = "project-learning",
}

export enum LearningSource {
  Product = "product",
  Image = "image",
  Video = "video",
  MarketingCampaign = "marketing-campaign",
  Branding = "branding",
  ProjectHistory = "project-history",
  WorkflowHistory = "workflow-history",
  DecisionHistory = "decision-history",
  ReasoningHistory = "reasoning-history",
  UserFeedback = "user-feedback",
  UserCorrection = "user-correction",
  ExportResult = "export-result",
  RecoveryHistory = "recovery-history",
}

export enum LearningOutcome {
  Success = "success",
  Failure = "failure",
  Partial = "partial",
  Correction = "correction",
}

export interface LearningEventInput {
  source: LearningSource;
  category: LearningCategory;
  title: string;
  description: string;
  relatedProject?: string;
  relatedWorkflow?: string;
  relatedMemoryIds?: string[];
  outcome?: LearningOutcome;
  qualityScore?: number;
  userFeedback?: string;
  lessonLearned?: string;
  patterns?: string[];
  metadata?: Record<string, unknown>;
}

export interface LearningRecord {
  learningId: string;
  learningType: LearningCategory;
  source: LearningSource;
  relatedProject?: string;
  relatedWorkflow?: string;
  relatedMemories: string[];
  confidenceScore: number;
  learningValue: number;
  creationTime: string;
  lastUpdate: string;
  futureUsage: number;
  title: string;
  description: string;
  outcome: LearningOutcome;
  memoryId: string;
  verified: boolean;
  patterns: string[];
}

export interface UserPreferences {
  videoStyle?: string;
  marketingStyle?: string;
  colors?: string[];
  branding?: string;
  animationSpeed?: string;
  transitions?: string;
  exportSettings?: Record<string, unknown>;
  preferredWorkflow?: string;
  lastUpdated: string;
}

export interface LearningProcessResult {
  success: boolean;
  learningId?: string;
  memoryId?: string;
  rejected: boolean;
  reason?: string;
  confidenceScore: number;
  learningValue: number;
  durationMs: number;
  stepsCompleted: number;
}

export interface SelfImprovementInsight {
  workedWell: string[];
  failed: string[];
  shouldImprove: string[];
  neverRepeat: string[];
  recommendations: string[];
}

export interface LearningMemoryStatusReport {
  engineStatus: string;
  learningAccuracy: number;
  preferenceLearningStatus: string;
  historyStatus: string;
  totalLearningRecords: number;
  totalPreferences: number;
  performance: {
    averageLearningMs: number;
    lastLearningMs: number;
    patternsDetected: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class LearningMemoryEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "LearningMemoryEngineError";
  }
}

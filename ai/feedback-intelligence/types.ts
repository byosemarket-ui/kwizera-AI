/** AI Learning Step 4 — Feedback Intelligence & User Learning types. */

export const FEEDBACK_INTELLIGENCE_VERSION = "1.0";

export type FeedbackSourceKind =
  | "user-review"
  | "user-rating"
  | "user-comment"
  | "manual-correction"
  | "video-revision"
  | "production-history"
  | "ai-self-review";

export type FeedbackTopic =
  | "camera"
  | "lighting"
  | "storytelling"
  | "product-presentation"
  | "background"
  | "animation"
  | "video-speed"
  | "camera-movement"
  | "music"
  | "voice"
  | "narration"
  | "audio"
  | "cta"
  | "price-display"
  | "logo-placement"
  | "rendering"
  | "overall-video-quality";

export type FeedbackClass =
  | "positive"
  | "negative"
  | "improvement-request"
  | "feature-request"
  | "bug-report"
  | "style-preference"
  | "quality-issue"
  | "performance-issue";

export interface FeedbackInput {
  id?: string;
  projectId: string;
  text: string;
  source: FeedbackSourceKind;
  rating?: number;
  userId?: string;
  accepted?: boolean;
  timestamp?: string;
  metadata?: Record<string, string>;
}

export interface AnalyzedFeedback {
  id: string;
  projectId: string;
  source: FeedbackSourceKind;
  text: string;
  rating?: number;
  topics: FeedbackTopic[];
  classification: FeedbackClass;
  sentimentScore: number;
  qualityScore: number;
  analyzedAt: string;
  acceptedForLearning: boolean;
  rootCause: FeedbackRootCause;
  professionalKnowledgeOverwritten: false;
}

export interface FeedbackRootCause {
  whatHappened: string;
  whyItHappened: string;
  moduleLikely: string;
  workflowLikely: string;
  knowledgeLikely: string;
  recommendedCorrection: string;
}

export interface LearningMemoryEntry {
  id: string;
  feedbackId: string;
  projectId: string;
  topics: FeedbackTopic[];
  classification: FeedbackClass;
  lesson: string;
  recommendationRule: string;
  workflowPreference?: string;
  qualityPreference?: string;
  stylePreference?: string;
  learnedAt: string;
}

export interface UserPreferenceProfile {
  userId: string;
  preferredVideoStyle: string | null;
  preferredCameraStyle: string | null;
  preferredLightingStyle: string | null;
  preferredBackgroundStyle: string | null;
  preferredMusicStyle: string | null;
  preferredVoiceStyle: string | null;
  preferredCtaStyle: string | null;
  preferredMarketingStyle: string | null;
  updatedAt: string;
  evolutionNotes: string[];
}

export interface ProjectFeedbackHistoryEntry {
  id: string;
  projectId: string;
  feedbackIds: string[];
  improvementsApplied: string[];
  finalResult: string;
  userSatisfaction: number | null;
  timestamp: string;
}

export interface RecommendationImprovement {
  id: string;
  basedOnFeedbackId: string;
  topic: FeedbackTopic;
  before: string;
  after: string;
  createdAt: string;
}

export interface FeedbackIntelligenceResult {
  runId: string;
  version: typeof FEEDBACK_INTELLIGENCE_VERSION;
  processedAt: string;
  analyzed: AnalyzedFeedback[];
  learningEntries: LearningMemoryEntry[];
  preferenceProfile: UserPreferenceProfile;
  projectHistory: ProjectFeedbackHistoryEntry[];
  recommendationImprovements: RecommendationImprovement[];
  issuesFound: string[];
  issuesRepaired: string[];
  professionalKnowledgeOverwritten: false;
  performanceAnalyticsDeferred: false;
  summary: string;
}

export interface AiMeFeedbackIntelligenceAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainWhatWasLearned: boolean;
  canExplainRecommendationChanges: boolean;
  canExplainPreferences: boolean;
  canRecommendFromPriorFeedback: boolean;
  performanceAnalyticsDeferred: false;
  summary: string;
}

export interface FeedbackIntelligenceExplainResult {
  feedbackId?: string;
  whatWasLearned: string;
  howRecommendationsChanged: string;
  whyPreferenceExists: string;
  recommendedImprovements: string[];
}

export interface FeedbackIntelligenceHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface FeedbackIntelligenceReportData {
  generatedAt: string;
  existingFeedbackCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  feedbackAnalyzed: Array<{ id: string; classification: string; topics: string[] }>;
  learningMemoryStatus: string;
  userPreferenceProfileStatus: string;
  projectHistoryStatus: string;
  recommendationImprovementStatus: string;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep5: string[];
}

export interface FeedbackIntelligenceStore {
  feedback: AnalyzedFeedback[];
  learningMemory: LearningMemoryEntry[];
  preferenceProfiles: UserPreferenceProfile[];
  projectHistory: ProjectFeedbackHistoryEntry[];
  recommendationImprovements: RecommendationImprovement[];
  runs: FeedbackIntelligenceResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}

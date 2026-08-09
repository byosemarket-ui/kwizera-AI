export { AiFeedbackIntelligenceEngine } from "./feedback-intelligence-engine.js";
export {
  analyzeRootCause,
  buildLesson,
  classifyFeedback,
  detectFeedbackTopics,
} from "./feedback-classifier.js";
export type {
  AiMeFeedbackIntelligenceAwareness,
  AnalyzedFeedback,
  FeedbackClass,
  FeedbackInput,
  FeedbackIntelligenceExplainResult,
  FeedbackIntelligenceHealthReport,
  FeedbackIntelligenceReportData,
  FeedbackIntelligenceResult,
  FeedbackRootCause,
  FeedbackSourceKind,
  FeedbackTopic,
  LearningMemoryEntry,
  ProjectFeedbackHistoryEntry,
  RecommendationImprovement,
  UserPreferenceProfile,
} from "./types.js";
export { FEEDBACK_INTELLIGENCE_VERSION } from "./types.js";

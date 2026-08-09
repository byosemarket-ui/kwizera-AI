export { AiAutonomousLearningEngine } from "./autonomous-learning-engine.js";
export {
  buildImpact,
  detectFocus,
  isAllowedLearningDomain,
  isUnrelatedTopic,
  LEARNING_DOMAINS,
  scoreCandidatePriority,
} from "./learning-priority.js";
export type {
  AiMeAutonomousLearningAwareness,
  AutonomousLearningCandidate,
  AutonomousLearningComposition,
  AutonomousLearningCycleOptions,
  AutonomousLearningDependencies,
  AutonomousLearningExplainResult,
  AutonomousLearningFeedbackPort,
  AutonomousLearningHealthReport,
  AutonomousLearningPerformancePort,
  AutonomousLearningReportData,
  AutonomousLearningResult,
  DiscoveredKnowledgeItem,
  LearningDomainId,
  SelfLearningSignal,
} from "./types.js";
export { AUTONOMOUS_LEARNING_VERSION } from "./types.js";

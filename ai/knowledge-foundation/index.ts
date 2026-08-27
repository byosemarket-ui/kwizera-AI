export { AiKnowledgeFoundation } from "./knowledge-foundation.js";
export { createKnowledgeFoundationPlugin } from "./knowledge-foundation-plugin.js";
export { KnowledgeRegistry } from "./knowledge-registry.js";
export { KnowledgeStorageManager } from "./knowledge-storage.js";
export { KnowledgePackImportEngine } from "./knowledge-pack-import-engine.js";
export { KnowledgeImportError } from "./knowledge-import-types.js";
export {
  KnowledgeTeachingService,
  createKnowledgeTeachingService,
} from "./knowledge-teaching-service.js";
export type {
  KnowledgeScope,
  TeachKnowledgeInput,
  TeachKnowledgeResult,
  RetrieveKnowledgeInput,
  RetrieveKnowledgeResult,
} from "./knowledge-teaching-service.js";
export { KnowledgeValidationIntegrationEngine } from "../knowledge-validation-integration/knowledge-validation-integration-engine.js";
export { KNOWLEDGE_VALIDATION_INTEGRATION_VERSION } from "../knowledge-validation-integration/types.js";
export type {
  AiMeKnowledgeValidationIntegrationAwareness,
  KnowledgeCandidateInput,
  KnowledgeValidationIntegrationExplainResult,
  KnowledgeValidationIntegrationReportData,
  KnowledgeValidationIntegrationResult,
  ValidatedKnowledgeItem,
} from "../knowledge-validation-integration/types.js";
export { AiKnowledgeEvolutionEngine } from "../knowledge-evolution/knowledge-evolution-engine.js";
export { KNOWLEDGE_EVOLUTION_VERSION } from "../knowledge-evolution/types.js";
export type {
  AiMeKnowledgeEvolutionAwareness,
  KnowledgeEvolutionExplainResult,
  KnowledgeEvolutionReportData,
  KnowledgeEvolutionResult,
} from "../knowledge-evolution/types.js";
export { AiFeedbackIntelligenceEngine } from "../feedback-intelligence/feedback-intelligence-engine.js";
export { FEEDBACK_INTELLIGENCE_VERSION } from "../feedback-intelligence/types.js";
export type {
  AiMeFeedbackIntelligenceAwareness,
  FeedbackInput,
  FeedbackIntelligenceExplainResult,
  FeedbackIntelligenceReportData,
  FeedbackIntelligenceResult,
} from "../feedback-intelligence/types.js";
export { AiPerformanceAnalyticsEngine } from "../performance-analytics/performance-analytics-engine.js";
export { PERFORMANCE_ANALYTICS_VERSION } from "../performance-analytics/types.js";
export type {
  AiMePerformanceAnalyticsAwareness,
  PerformanceAnalyticsExplainResult,
  PerformanceAnalyticsReportData,
  PerformanceAnalyticsResult,
  ProductionSessionInput,
} from "../performance-analytics/types.js";
export { AiAutonomousLearningEngine } from "../autonomous-learning/autonomous-learning-engine.js";
export { AUTONOMOUS_LEARNING_VERSION } from "../autonomous-learning/types.js";
export type {
  AiMeAutonomousLearningAwareness,
  AutonomousLearningCandidate,
  AutonomousLearningExplainResult,
  AutonomousLearningReportData,
  AutonomousLearningResult,
} from "../autonomous-learning/types.js";
export { AiWorkflowModelOptimizationEngine } from "../workflow-model-optimization/workflow-model-optimization-engine.js";
export { WORKFLOW_MODEL_OPTIMIZATION_VERSION } from "../workflow-model-optimization/types.js";
export type {
  AiMeWorkflowModelOptimizationAwareness,
  WorkflowModelOptimizationExplainResult,
  WorkflowModelOptimizationInput,
  WorkflowModelOptimizationReportData,
  WorkflowModelOptimizationResult,
} from "../workflow-model-optimization/types.js";
export { AiAutonomousImprovementEngine } from "../autonomous-improvement/autonomous-improvement-engine.js";
export { AUTONOMOUS_IMPROVEMENT_VERSION } from "../autonomous-improvement/types.js";
export type {
  AiMeAutonomousImprovementAwareness,
  AutonomousImprovementCycleInput,
  AutonomousImprovementExplainResult,
  AutonomousImprovementReportData,
  AutonomousImprovementResult,
} from "../autonomous-improvement/types.js";
export { AiAutonomousIntelligenceValidationEngine } from "../autonomous-intelligence-validation/autonomous-intelligence-validation-engine.js";
export { AUTONOMOUS_INTELLIGENCE_VALIDATION_VERSION } from "../autonomous-intelligence-validation/types.js";
export type {
  AiMeAutonomousIntelligenceValidationAwareness,
  AutonomousIntelligenceValidationExplainResult,
  AutonomousIntelligenceValidationReportData,
  AutonomousIntelligenceValidationResult,
} from "../autonomous-intelligence-validation/types.js";
export { AiLearningCertificationEngine } from "../learning-certification/learning-certification-engine.js";
export {
  LEARNING_CERTIFICATION_VERSION,
  LEARNING_CONTINUOUS_IMPROVEMENT_PRODUCT_VERSION,
} from "../learning-certification/types.js";
export type {
  AiMeLearningCertificationAwareness,
  LearningCertificationExplainResult,
  LearningCertificationReportData,
  LearningCertificationResult,
} from "../learning-certification/types.js";
export { AiPersonalProjectWorkspaceEngine } from "../personal-project-workspace/personal-project-workspace-engine.js";
export { PERSONAL_PROJECT_WORKSPACE_VERSION } from "../personal-project-workspace/types.js";
export type {
  AiMePersonalWorkspaceAwareness,
  CreateWorkspaceProjectInput,
  PersonalProjectWorkspaceResult,
  PersonalWorkspaceExplainResult,
  PersonalWorkspaceReportData,
} from "../personal-project-workspace/types.js";
export { AiLocalAssetLibraryEngine } from "../local-asset-library/local-asset-library-engine.js";
export { LOCAL_ASSET_LIBRARY_VERSION } from "../local-asset-library/types.js";
export type {
  AiMeLocalAssetLibraryAwareness,
  AssetImportInput,
  LocalAssetLibraryExplainResult,
  LocalAssetLibraryReportData,
  LocalAssetLibraryResult,
} from "../local-asset-library/types.js";
export { AiLocalProductionQueueEngine } from "../local-production-queue/local-production-queue-engine.js";
export { LOCAL_PRODUCTION_QUEUE_VERSION } from "../local-production-queue/types.js";
export type {
  AiMeLocalProductionQueueAwareness,
  EnqueueJobInput,
  LocalProductionQueueExplainResult,
  LocalProductionQueueReportData,
  LocalProductionQueueResult,
} from "../local-production-queue/types.js";
export { AiLocalResourceManagerEngine } from "../local-resource-manager/local-resource-manager-engine.js";
export { LOCAL_RESOURCE_MANAGER_VERSION } from "../local-resource-manager/types.js";
export type {
  AiMeLocalResourceManagerAwareness,
  LocalResourceManagerExplainResult,
  LocalResourceManagerReportData,
  LocalResourceManagerResult,
  ProductionMode,
} from "../local-resource-manager/types.js";
export { AiAutomationEngine } from "../automation-engine/automation-engine.js";
export { AUTOMATION_ENGINE_VERSION } from "../automation-engine/types.js";
export type {
  AiMeAutomationEngineAwareness,
  AutomationEngineExplainResult,
  AutomationEngineReportData,
  AutomationEngineResult,
} from "../automation-engine/types.js";
export { AiWorkspaceManagerEngine } from "../workspace-manager/workspace-manager-engine.js";
export { WORKSPACE_MANAGER_VERSION } from "../workspace-manager/types.js";
export type {
  AiMeWorkspaceManagerAwareness,
  WorkspaceManagerExplainResult,
  WorkspaceManagerReportData,
  WorkspaceManagerResult,
} from "../workspace-manager/types.js";
export { KnowledgeSeedingCertifier } from "./knowledge-seeding-certifier.js";
export { KnowledgePersistenceVerifier } from "./knowledge-persistence-verifier.js";
export { ProfessionalKnowledgeCertificationEngine } from "./professional-knowledge-certification-engine.js";
export {
  ProfessionalKnowledgeCertificationError,
  PROFESSIONAL_KNOWLEDGE_EXPANSION_VERSION,
} from "./professional-knowledge-certification-types.js";
export { KnowledgeSeedingError, KNOWLEDGE_SEEDING_VERSION } from "./knowledge-seeding-types.js";
export type {
  KnowledgeImportStatus,
  KnowledgeImportResult,
  KnowledgeActivationStatus,
  KnowledgeEngineIntegrationStatus,
  AiMeKnowledgeImportAwareness,
  KnowledgeImportHealthReport,
  KnowledgeImportRepairResult,
  KnowledgeImportReportData,
} from "./knowledge-import-types.js";
export type {
  KnowledgePersistenceCheck,
  KnowledgePersistenceVerificationResult,
  KnowledgeRestartVerificationResult,
  KnowledgeSeedingStatistics,
  AiMeKnowledgePersistenceAwareness,
  KnowledgeSeedingCertificationResult,
  KnowledgeSeedingRepairResult,
  KnowledgeSeedingReportData,
} from "./knowledge-seeding-types.js";
export type {
  ProfessionalCertificationCheckStatus,
  ProfessionalKnowledgeCertificationCheck,
  ProfessionalKnowledgeDomainCertification,
  ProfessionalKnowledgeCapabilityVerification,
  ProfessionalKnowledgeFoundationVerification,
  ProfessionalKnowledgeCertificationResult,
  ProfessionalKnowledgeCertificationRepairResult,
  AiMeProfessionalKnowledgeCertificationAwareness,
} from "./professional-knowledge-certification-types.js";
export { AiKnowledgeStorageEngine } from "../knowledge-storage-engine/knowledge-storage-engine.js";
export { AiKnowledgeRetrievalEngine } from "../knowledge-retrieval-engine/knowledge-retrieval-engine.js";
export { AiKnowledgeGraphEngine } from "../knowledge-graph-engine/knowledge-graph-engine.js";
export { AiImageKnowledgeEngine } from "../image-knowledge-engine/image-knowledge-engine.js";
export { AiVideoKnowledgeEngine } from "../video-knowledge-engine/video-knowledge-engine.js";
export { AiMarketingKnowledgeEngine } from "../marketing-knowledge-engine/marketing-knowledge-engine.js";
export { AiProductKnowledgeEngine } from "../product-knowledge-engine/product-knowledge-engine.js";
export { AiBrandKnowledgeEngine } from "../brand-knowledge-engine/brand-knowledge-engine.js";
export { AiLanguageKnowledgeEngine } from "../language-knowledge-engine/language-knowledge-engine.js";
export { AiCreativeKnowledgeEngine } from "../creative-knowledge-engine/creative-knowledge-engine.js";
export { AiKnowledgeOptimizationEngine } from "../knowledge-optimization-engine/knowledge-optimization-engine.js";
export { AiKnowledgeValidationEngine } from "../knowledge-validation-engine/knowledge-validation-engine.js";
export { AiKnowledgeHealthMonitorEngine } from "../knowledge-health-monitor-engine/knowledge-health-monitor-engine.js";
export { AiKnowledgeAcquisitionEngine } from "../knowledge-acquisition-engine/knowledge-acquisition-engine.js";
export { AiKnowledgeDomainPlanner } from "../knowledge-domain-planning/knowledge-domain-planner.js";
export {
  CORE_KNOWLEDGE_DOMAINS,
  KNOWLEDGE_DOMAIN_ARCHITECTURE_VERSION,
  REQUIRED_KNOWLEDGE_DOMAIN_IDS,
  KnowledgeDomainStatus,
  KnowledgeDomainPriority,
  KnowledgeDomainOrigin,
  KnowledgeDomainPlanningError,
} from "../knowledge-domain-planning/index.js";
export type {
  KnowledgeDomainDefinition,
  KnowledgeDomainRegistrationInput,
  KnowledgeDomainRelationship,
  KnowledgeDomainHierarchyNode,
  AiMeDomainAwareness,
  KnowledgeDomainPlanningReportData,
  KnowledgeDomainPlanningStatusReport,
} from "../knowledge-domain-planning/index.js";
export { KnowledgeAccessCoordinator } from "./knowledge-access-coordinator.js";
export { KnowledgeHealthMonitor } from "./knowledge-health-monitor.js";
export { KnowledgeQualityValidator } from "./knowledge-quality-validator.js";
export { KnowledgeIntegrationBridge } from "./knowledge-integration-bridge.js";
export { KnowledgeFoundationLogger } from "./knowledge-logger.js";
export { KnowledgeHistoryStore } from "./knowledge-history-store.js";
export { PREPARED_KNOWLEDGE_CATEGORIES, SUPPORTED_KNOWLEDGE_SOURCES } from "./knowledge-categories.js";
export {
  KnowledgeLifecycleState,
  KnowledgeCategory,
  KnowledgeModuleStatus,
  KnowledgeHealthLevel,
  KnowledgeSource,
  KnowledgeVerificationStatus,
  KnowledgeAccessPermission,
  KnowledgeAccessOperation,
  KnowledgeFoundationError,
} from "./types.js";
export type {
  KnowledgeModuleRegistration,
  KnowledgeRegistrySnapshot,
  KnowledgeIntegrityResult,
  KnowledgeAccessRequest,
  KnowledgeAccessResult,
  KnowledgeValidationResult,
  KnowledgeHealthReport,
  KnowledgeIntegrationStatus,
  KnowledgeFoundationStatusReport,
  KnowledgeQualityMetadata,
  KnowledgeVersionEntry,
} from "./types.js";
export type {
  KnowledgeAcquisitionImportResult,
  KnowledgeAcquisitionPreview,
  KnowledgeAcquisitionRequest,
  KnowledgeAcquisitionSource,
  KnowledgeAcquisitionSourceType,
} from "../knowledge-acquisition-engine/types.js";

import type { KnowledgeAcquisitionPreview, KnowledgeAcquisitionSource } from "../knowledge-acquisition-engine/types.js";
import type { VideoProductionKnowledgeAdvisory } from "../video-knowledge-engine/video-production-knowledge-builder.js";
import type { ProfessionalKnowledgeReasoningResult } from "../knowledge-reasoning-engine/types.js";
import type { AiMeDomainAwareness } from "../knowledge-domain-planning/types.js";
import type {
  AiMeTrustedSourceAwareness,
  TrustedSourceDiscoveryRecommendation,
} from "../knowledge-source-manager/types.js";
import type { AiMeKnowledgeCollectionAwareness } from "../knowledge-research-engine/types.js";
import type { AiMeDocumentAwareness } from "../knowledge-processing-engine/document-understanding-types.js";
import type { AiMeKnowledgePackAwareness } from "../knowledge-processing-engine/knowledge-extraction-types.js";
import type { AiMePackValidationAwareness } from "../knowledge-validation-engine/knowledge-pack-validation-types.js";
import type { AiMeKnowledgeImportAwareness } from "../knowledge-foundation/knowledge-import-types.js";
import type { AiMeKnowledgePersistenceAwareness } from "../knowledge-foundation/knowledge-seeding-types.js";

export type ConversationLanguage = "en" | "rw" | "mixed" | "unknown";

export type ConversationIntent =
  | "image-generation"
  | "video-generation"
  | "product-analysis"
  | "product-asset-preparation"
  | "product-scene-planning"
  | "product-storyboard"
  | "product-prompt-orchestration"
  | "product-image-generation"
  | "product-video-generation"
  | "product-audio-generation"
  | "product-rendering-export"
  | "editing"
  | "marketing"
  | "business-intelligence"
  | "workspace-synchronization"
  | "enterprise-integration"
  | "enterprise-collaboration"
  | "publishing-distribution"
  | "translation"
  | "knowledge-acquisition"
  | "knowledge-domains"
  | "knowledge-sources"
  | "knowledge-collection"
  | "online-research"
  | "knowledge-validation-integration"
  | "knowledge-evolution"
  | "feedback-intelligence"
  | "performance-analytics"
  | "autonomous-learning"
  | "workflow-model-optimization"
  | "autonomous-improvement"
  | "autonomous-intelligence-validation"
  | "learning-certification"
  | "personal-project-workspace"
  | "local-asset-library"
  | "local-production-queue"
  | "local-resource-manager"
  | "automation-engine"
  | "workspace-manager"
  | "knowledge-documents"
  | "knowledge-packs"
  | "knowledge-validation"
  | "knowledge-import"
  | "knowledge-persistence"
  | "video-production-knowledge"
  | "camera-knowledge"
  | "lighting-composition-knowledge"
  | "storytelling-scene-knowledge"
  | "animation-motion-rendering-knowledge"
  | "marketing-branding-psychology-knowledge"
  | "social-media-knowledge"
  | "industry-standards-quality-knowledge"
  | "professional-knowledge-certification"
  | "professional-knowledge-reasoning"
  | "professional-decision-intelligence"
  | "professional-planning-intelligence"
  | "professional-workflow-intelligence"
  | "professional-recommendation-intelligence"
  | "professional-multi-domain-intelligence"
  | "professional-self-review-intelligence"
  | "professional-reasoning-certification"
  | "project-management"
  | "system"
  | "general";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  intent?: ConversationIntent;
}

export interface ConversationRecord {
  id: string;
  coreSessionId?: string;
  projectId?: string;
  language: ConversationLanguage;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  pendingPlan?: ConversationPlan;
  pendingKnowledgeRequestId?: string;
}

export interface ConversationPlan {
  intent: ConversationIntent;
  requiredEngines: string[];
  complexity: "low" | "medium" | "high";
  readyForWorkflow: boolean;
  missingInformation: string[];
  decision?: {
    decisionId: string;
    status: string;
    approved: boolean;
    canExecute: boolean;
    taskCount: number;
    estimatedProcessingMs?: number;
    alternatives: number;
    risks: string[];
  };
}

export interface ConversationResponse {
  conversation: ConversationRecord;
  language: ConversationLanguage;
  plan: ConversationPlan;
  response: string;
  context: { memoryMatches: number; knowledgeMatches: number; projectKnown: boolean };
  execution?: { dispatched: boolean; jobId?: string; error?: string };
  knowledgeAcquisition?: KnowledgeAcquisitionPreview | { imported: boolean; knowledgeId?: string; reason?: string };
  videoKnowledge?: VideoProductionKnowledgeAdvisory;
  professionalKnowledge?: ProfessionalKnowledgeReasoningResult;
  domainAwareness?: AiMeDomainAwareness;
  trustedSourceAwareness?: AiMeTrustedSourceAwareness;
  trustedSourceRecommendation?: TrustedSourceDiscoveryRecommendation | null;
  knowledgeCollectionAwareness?: AiMeKnowledgeCollectionAwareness;
  onlineResearchAwareness?: import("../knowledge-research-engine/types.js").AiMeOnlineResearchAwareness;
  onlineResearchSession?: import("../knowledge-research-engine/types.js").OnlineResearchSessionResult;
  knowledgeValidationIntegrationAwareness?: import("../knowledge-validation-integration/types.js").AiMeKnowledgeValidationIntegrationAwareness;
  knowledgeValidationIntegrationResult?: import("../knowledge-validation-integration/types.js").KnowledgeValidationIntegrationResult;
  knowledgeEvolutionAwareness?: import("../knowledge-evolution/types.js").AiMeKnowledgeEvolutionAwareness;
  knowledgeEvolutionResult?: import("../knowledge-evolution/types.js").KnowledgeEvolutionResult;
  feedbackIntelligenceAwareness?: import("../feedback-intelligence/types.js").AiMeFeedbackIntelligenceAwareness;
  feedbackIntelligenceResult?: import("../feedback-intelligence/types.js").FeedbackIntelligenceResult;
  performanceAnalyticsAwareness?: import("../performance-analytics/types.js").AiMePerformanceAnalyticsAwareness;
  performanceAnalyticsResult?: import("../performance-analytics/types.js").PerformanceAnalyticsResult;
  autonomousLearningAwareness?: import("../autonomous-learning/types.js").AiMeAutonomousLearningAwareness;
  autonomousLearningResult?: import("../autonomous-learning/types.js").AutonomousLearningResult;
  workflowModelOptimizationAwareness?: import("../workflow-model-optimization/types.js").AiMeWorkflowModelOptimizationAwareness;
  workflowModelOptimizationResult?: import("../workflow-model-optimization/types.js").WorkflowModelOptimizationResult;
  autonomousImprovementAwareness?: import("../autonomous-improvement/types.js").AiMeAutonomousImprovementAwareness;
  autonomousImprovementResult?: import("../autonomous-improvement/types.js").AutonomousImprovementResult;
  autonomousIntelligenceValidationAwareness?: import("../autonomous-intelligence-validation/types.js").AiMeAutonomousIntelligenceValidationAwareness;
  autonomousIntelligenceValidationResult?: import("../autonomous-intelligence-validation/types.js").AutonomousIntelligenceValidationResult;
  learningCertificationAwareness?: import("../learning-certification/types.js").AiMeLearningCertificationAwareness;
  learningCertificationResult?: import("../learning-certification/types.js").LearningCertificationResult;
  personalProjectWorkspaceAwareness?: import("../personal-project-workspace/types.js").AiMePersonalWorkspaceAwareness;
  personalProjectWorkspaceResult?: import("../personal-project-workspace/types.js").PersonalProjectWorkspaceResult;
  localAssetLibraryAwareness?: import("../local-asset-library/types.js").AiMeLocalAssetLibraryAwareness;
  localAssetLibraryResult?: import("../local-asset-library/types.js").LocalAssetLibraryResult;
  localProductionQueueAwareness?: import("../local-production-queue/types.js").AiMeLocalProductionQueueAwareness;
  localProductionQueueResult?: import("../local-production-queue/types.js").LocalProductionQueueResult;
  localResourceManagerAwareness?: import("../local-resource-manager/types.js").AiMeLocalResourceManagerAwareness;
  localResourceManagerResult?: import("../local-resource-manager/types.js").LocalResourceManagerResult;
  automationEngineAwareness?: import("../automation-engine/types.js").AiMeAutomationEngineAwareness;
  automationEngineResult?: import("../automation-engine/types.js").AutomationEngineResult;
  workspaceManagerAwareness?: import("../workspace-manager/types.js").AiMeWorkspaceManagerAwareness;
  workspaceManagerResult?: import("../workspace-manager/types.js").WorkspaceManagerResult;
  documentAwareness?: AiMeDocumentAwareness;
  knowledgePackAwareness?: AiMeKnowledgePackAwareness;
  knowledgePackValidationAwareness?: AiMePackValidationAwareness;
  knowledgeImportAwareness?: AiMeKnowledgeImportAwareness;
  knowledgePersistenceAwareness?: AiMeKnowledgePersistenceAwareness;
  videoProductionKnowledgeAwareness?: import("../video-knowledge-engine/professional-video-production-types.js").AiMeVideoProductionKnowledgeAwareness;
  cameraKnowledgeAwareness?: import("../video-knowledge-engine/professional-camera-knowledge-types.js").AiMeCameraKnowledgeAwareness;
  lightingCompositionAwareness?: import("../video-knowledge-engine/professional-lighting-composition-types.js").AiMeLightingCompositionAwareness;
  storytellingSceneAwareness?: import("../video-knowledge-engine/professional-storytelling-scene-types.js").AiMeStorytellingSceneAwareness;
  animationMotionRenderingAwareness?: import("../video-knowledge-engine/professional-animation-motion-rendering-types.js").AiMeAmrAwareness;
  marketingBrandingPsychologyAwareness?: import("../video-knowledge-engine/professional-marketing-branding-psychology-types.js").AiMeMbpAwareness;
  socialMediaKnowledgeAwareness?: import("../video-knowledge-engine/professional-social-media-types.js").AiMeSocialMediaAwareness;
  industryStandardsQualityAwareness?: import("../video-knowledge-engine/professional-industry-standards-quality-types.js").AiMeIndustryStandardsAwareness;
  professionalKnowledgeCertificationAwareness?: import("../knowledge-foundation/professional-knowledge-certification-types.js").AiMeProfessionalKnowledgeCertificationAwareness;
  professionalReasoningAwareness?: import("../knowledge-reasoning-engine/types.js").AiMeProfessionalReasoningAwareness;
  professionalDecision?: import("../decision/professional-decision-types.js").ProfessionalDecisionResult;
  professionalDecisionAwareness?: import("../decision/professional-decision-types.js").AiMeProfessionalDecisionAwareness;
  professionalPlan?: import("../planning/professional-planning-types.js").ProfessionalPlanningResult;
  professionalPlanningAwareness?: import("../planning/professional-planning-types.js").AiMeProfessionalPlanningAwareness;
  professionalWorkflow?: import("../workflow/professional-workflow-types.js").ProfessionalWorkflowResult;
  professionalWorkflowAwareness?: import("../workflow/professional-workflow-types.js").AiMeProfessionalWorkflowAwareness;
  professionalRecommendation?: import("../recommendation/professional-recommendation-types.js").ProfessionalRecommendationResult;
  professionalRecommendationAwareness?: import("../recommendation/professional-recommendation-types.js").AiMeProfessionalRecommendationAwareness;
  professionalMultiDomain?: import("../multi-domain/professional-multi-domain-types.js").ProfessionalMultiDomainResult;
  professionalMultiDomainAwareness?: import("../multi-domain/professional-multi-domain-types.js").AiMeProfessionalMultiDomainAwareness;
  professionalSelfReview?: import("../self-review/professional-self-review-types.js").ProfessionalSelfReviewResult;
  professionalSelfReviewAwareness?: import("../self-review/professional-self-review-types.js").AiMeProfessionalSelfReviewAwareness;
  professionalReasoningCertification?: import("../professional-reasoning-certification/professional-reasoning-certification-types.js").ProfessionalReasoningCertificationResult;
  professionalReasoningCertificationAwareness?: import("../professional-reasoning-certification/professional-reasoning-certification-types.js").AiMeProfessionalReasoningCertificationAwareness;
  productIntelligence?: import("../product-intelligence/types.js").ProductIntelligenceExplainResult;
  productIntelligenceAwareness?: import("../product-intelligence/types.js").AiMeProductIntelligenceAwareness;
  productIntelligenceProfile?: import("../product-intelligence/types.js").ProductIntelligenceProfile;
  productAssetPreparation?: import("../product-asset-preparation/types.js").ProductAssetExplainResult;
  productAssetPreparationAwareness?: import("../product-asset-preparation/types.js").AiMeProductAssetAwareness;
  productAssetPreparationResult?: import("../product-asset-preparation/types.js").ProductAssetPreparationResult;
  productScenePlanning?: import("../product-scene-planning/types.js").ProductSceneExplainResult;
  productScenePlanningAwareness?: import("../product-scene-planning/types.js").AiMeProductScenePlanningAwareness;
  productScenePlanResult?: import("../product-scene-planning/types.js").ProductScenePlanResult;
  productStoryboard?: import("../product-storyboard/types.js").ProductStoryboardExplainResult;
  productStoryboardAwareness?: import("../product-storyboard/types.js").AiMeProductStoryboardAwareness;
  productStoryboardResult?: import("../product-storyboard/types.js").ProductStoryboardResult;
  productPromptOrchestration?: import("../product-prompt-orchestration/types.js").ProductPromptOrchestrationExplainResult;
  productPromptOrchestrationAwareness?: import("../product-prompt-orchestration/types.js").AiMeProductPromptOrchestrationAwareness;
  productPromptOrchestrationResult?: import("../product-prompt-orchestration/types.js").ProductPromptOrchestrationResult;
  productImageGeneration?: import("../product-image-generation/types.js").ProductImageGenerationExplainResult;
  productImageGenerationAwareness?: import("../product-image-generation/types.js").AiMeProductImageGenerationAwareness;
  productImageGenerationResult?: import("../product-image-generation/types.js").ProductImageGenerationResult;
  productVideoGeneration?: import("../product-video-generation/types.js").ProductVideoGenerationExplainResult;
  productVideoGenerationAwareness?: import("../product-video-generation/types.js").AiMeProductVideoGenerationAwareness;
  productVideoGenerationResult?: import("../product-video-generation/types.js").ProductVideoGenerationResult;
  productAudioGeneration?: import("../product-audio-generation/types.js").ProductAudioGenerationExplainResult;
  productAudioGenerationAwareness?: import("../product-audio-generation/types.js").AiMeProductAudioGenerationAwareness;
  productAudioGenerationResult?: import("../product-audio-generation/types.js").ProductAudioGenerationResult;
  productRenderingExport?: import("../product-rendering-export/types.js").ProductRenderingExportExplainResult;
  productRenderingExportAwareness?: import("../product-rendering-export/types.js").AiMeProductRenderingExportAwareness;
  productRenderingExportResult?: import("../product-rendering-export/types.js").ProductRenderingExportResult;
  creativeGenerationCertification?: import("../creative-generation-certification/types.js").CreativeGenerationCertificationExplainResult;
  creativeGenerationCertificationAwareness?: import("../creative-generation-certification/types.js").AiMeCreativeGenerationCertificationAwareness;
  creativeGenerationCertificationResult?: import("../creative-generation-certification/types.js").CreativeGenerationCertificationResult;
}

export interface ConversationInput {
  conversationId?: string;
  message: string;
  projectId?: string;
  knowledgeSources?: KnowledgeAcquisitionSource[];
}
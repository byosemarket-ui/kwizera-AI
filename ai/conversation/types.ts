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
}

export interface ConversationInput {
  conversationId?: string;
  message: string;
  projectId?: string;
  knowledgeSources?: KnowledgeAcquisitionSource[];
}
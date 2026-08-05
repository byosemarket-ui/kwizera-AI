/**
 * Professional Video Production Knowledge — Knowledge Expansion Step 1 types.
 * Learning/organization only — does not generate videos.
 */

export const PROFESSIONAL_VIDEO_PRODUCTION_VERSION = "1.0.0";
export const VIDEO_PRODUCTION_DOMAIN_ID = "video-production-knowledge";
export const VIDEO_PRODUCTION_KNOWLEDGE_SOURCE = "professional-video-production-knowledge";

export type VideoProductionTopicId =
  | "video-production-fundamentals"
  | "types-of-marketing-videos"
  | "commercial-video-production"
  | "product-advertisement-videos"
  | "social-media-videos"
  | "corporate-videos"
  | "story-structure"
  | "shot-types"
  | "shot-planning"
  | "scene-planning"
  | "camera-coverage"
  | "video-pacing"
  | "visual-rhythm"
  | "video-style"
  | "production-workflow"
  | "pre-production"
  | "production"
  | "post-production"
  | "professional-planning-methods";

export type VideoProductionRelatedDomainId =
  | "video-production-knowledge"
  | "camera-knowledge"
  | "lighting-knowledge"
  | "storytelling-knowledge"
  | "marketing-knowledge"
  | "video-editing-knowledge"
  | "rendering-knowledge"
  | "animation-knowledge";

export interface ProfessionalVideoProductionTopic {
  topicId: VideoProductionTopicId;
  knowledgeId: string;
  title: string;
  description: string;
  professionalDefinition: string;
  bestPractices: string[];
  commonMistakes: string[];
  professionalWorkflow: string[];
  examples: string[];
  decisionRules: string[];
  relatedTopics: VideoProductionTopicId[];
  relatedDomains: VideoProductionRelatedDomainId[];
  keywords: string[];
  confidenceScore: number;
  qualityScore: number;
  metadata: {
    domainId: typeof VIDEO_PRODUCTION_DOMAIN_ID;
    category: "professional-video-production";
    difficulty: "foundation" | "intermediate" | "advanced";
    expansionStep: 1;
    version: typeof PROFESSIONAL_VIDEO_PRODUCTION_VERSION;
    learningOnly: true;
    generatesVideo: false;
  };
}

export interface VideoProductionDomainBridge {
  domainId: VideoProductionRelatedDomainId;
  knowledgeId: string;
  title: string;
  description: string;
  relationshipEvidence: string;
}

export interface AiMeVideoProductionKnowledgeAwareness {
  canExplain: boolean;
  canRecommendWorkflows: boolean;
  canRecommendBestPractices: boolean;
  canCompareMethods: boolean;
  canAnswerProfessionalQuestions: boolean;
  topicCount: number;
  relationshipCount: number;
  averageConfidence: number;
  averageQuality: number;
  domainContentReady: boolean;
  summary: string;
}

export interface VideoProductionKnowledgeHealthReport {
  healthy: boolean;
  completenessScore: number;
  missingConcepts: string[];
  duplicateKnowledge: string[];
  brokenRelationships: string[];
  issues: string[];
}

export interface VideoProductionKnowledgeRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface VideoProductionKnowledgeInstallResult {
  installed: boolean;
  topicsInstalled: number;
  topicsUpdated: number;
  bridgesInstalled: number;
  relationshipsCreated: number;
  packSynced: boolean;
  domainMarkedReady: boolean;
  issues: string[];
}

export interface VideoProductionKnowledgeCompareResult {
  topicA: string;
  topicB: string;
  similarities: string[];
  differences: string[];
  recommendation: string;
  confidenceScore: number;
}

export interface VideoProductionKnowledgeExplainResult {
  available: boolean;
  knowledgeId: string | null;
  title: string;
  explanation: string;
  professionalDefinition: string;
  bestPractices: string[];
  workflow: string[];
  decisionRules: string[];
  relatedTopics: string[];
  confidenceScore: number;
  qualityScore: number;
}

export class ProfessionalVideoProductionError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "ProfessionalVideoProductionError";
  }
}

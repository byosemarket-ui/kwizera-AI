/**
 * Professional Storytelling & Scene Design Knowledge — Expansion Step 4 types.
 * Learning/organization only — does not generate videos.
 */

export const PROFESSIONAL_STORYTELLING_SCENE_VERSION = "1.0.0";
export const STORYTELLING_DOMAIN_ID = "storytelling-knowledge";
export const SCENE_DOMAIN_ID = "scene-knowledge";
export const STORYTELLING_SCENE_KNOWLEDGE_SOURCE = "professional-storytelling-scene-knowledge";

export type StorytellingTopicId =
  | "storytelling-fundamentals"
  | "story-structure"
  | "three-act-structure"
  | "narrative-flow"
  | "beginning"
  | "middle"
  | "ending"
  | "character-development"
  | "conflict"
  | "resolution"
  | "emotional-journey"
  | "call-to-action-placement"
  | "brand-storytelling"
  | "product-storytelling"
  | "customer-journey"
  | "visual-storytelling";

export type SceneDesignTopicId =
  | "scene-planning"
  | "scene-composition"
  | "scene-continuity"
  | "scene-transition-planning"
  | "scene-timing"
  | "scene-purpose"
  | "opening-scene"
  | "closing-scene"
  | "hero-scene"
  | "product-reveal-scene"
  | "lifestyle-scene"
  | "demonstration-scene"
  | "comparison-scene"
  | "testimonial-scene"
  | "background-selection"
  | "props-selection"
  | "environment-design";

export type StorytellingSceneRelatedDomainId =
  | "storytelling-knowledge"
  | "scene-knowledge"
  | "camera-knowledge"
  | "camera-movement-knowledge"
  | "lighting-knowledge"
  | "composition-knowledge"
  | "video-production-knowledge"
  | "marketing-knowledge"
  | "branding-knowledge"
  | "product-knowledge"
  | "rendering-knowledge";

export interface ProfessionalStorytellingSceneTopic {
  topicId: StorytellingTopicId | SceneDesignTopicId;
  knowledgeId: string;
  name: string;
  title: string;
  description: string;
  purpose: string;
  professionalDefinition: string;
  whenToUse: string[];
  whenNotToUse: string[];
  bestPractices: string[];
  commonMistakes: string[];
  workflow: string[];
  professionalExamples: string[];
  relatedTopics: Array<StorytellingTopicId | SceneDesignTopicId>;
  relatedDomains: StorytellingSceneRelatedDomainId[];
  keywords: string[];
  confidenceScore: number;
  qualityScore: number;
  metadata: {
    domainId: typeof STORYTELLING_DOMAIN_ID | typeof SCENE_DOMAIN_ID;
    category: "professional-storytelling" | "professional-scene-design";
    difficulty: "foundation" | "intermediate" | "advanced";
    expansionStep: 4;
    version: typeof PROFESSIONAL_STORYTELLING_SCENE_VERSION;
    learningOnly: true;
    generatesVideo: false;
  };
}

export interface StorytellingSceneDomainBridge {
  domainId: StorytellingSceneRelatedDomainId;
  knowledgeId: string;
  title: string;
  description: string;
  relationshipEvidence: string;
}

export interface AiMeStorytellingSceneAwareness {
  canBuildStoryStructures: boolean;
  canRecommendSceneSequences: boolean;
  canExplainStorytellingDecisions: boolean;
  canRecommendEmotionalFlow: boolean;
  canRecommendSceneLayouts: boolean;
  canAnswerQuestions: boolean;
  storytellingTopicCount: number;
  sceneTopicCount: number;
  relationshipCount: number;
  averageConfidence: number;
  averageQuality: number;
  storytellingDomainReady: boolean;
  sceneDomainReady: boolean;
  summary: string;
}

export interface StorytellingSceneHealthReport {
  healthy: boolean;
  completenessScore: number;
  missingConcepts: string[];
  missingStoryStructureConcepts: string[];
  brokenSceneRelationships: string[];
  duplicateKnowledge: string[];
  consistencyIssues: string[];
  issues: string[];
}

export interface StorytellingSceneRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface StorytellingSceneInstallResult {
  installed: boolean;
  storytellingInstalled: number;
  storytellingUpdated: number;
  sceneInstalled: number;
  sceneUpdated: number;
  bridgesInstalled: number;
  relationshipsCreated: number;
  storytellingPackSynced: boolean;
  scenePackSynced: boolean;
  domainsMarkedReady: boolean;
  issues: string[];
}

export interface StoryStructureResult {
  available: boolean;
  structureName: string;
  acts: Array<{ name: string; purpose: string; sceneHints: string[] }>;
  emotionalFlow: string[];
  ctaPlacement: string;
  reason: string;
  knowledgeIds: string[];
  confidenceScore: number;
}

export interface SceneSequenceRecommendation {
  available: boolean;
  sequenceName: string;
  scenes: Array<{ name: string; purpose: string; timingHint: string }>;
  reason: string;
  knowledgeIds: string[];
  confidenceScore: number;
}

export interface EmotionalFlowRecommendation {
  available: boolean;
  flowName: string;
  stages: string[];
  reason: string;
  knowledgeIds: string[];
  confidenceScore: number;
}

export interface SceneLayoutRecommendation {
  available: boolean;
  sceneName: string;
  layoutGuidance: string[];
  purpose: string;
  reason: string;
  knowledgeIds: string[];
  confidenceScore: number;
}

export interface StorytellingExplainResult {
  available: boolean;
  knowledgeId: string | null;
  title: string;
  explanation: string;
  bestPractices: string[];
  confidenceScore: number;
  qualityScore: number;
  kind: "storytelling" | "scene-design" | "none";
}

export class ProfessionalStorytellingSceneError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "ProfessionalStorytellingSceneError";
  }
}

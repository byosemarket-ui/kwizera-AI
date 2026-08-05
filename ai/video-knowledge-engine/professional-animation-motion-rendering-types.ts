/**
 * Professional Animation, Motion Graphics & Rendering Knowledge — Expansion Step 5 types.
 * Learning/organization only — does not render videos or images.
 */

export const PROFESSIONAL_ANIMATION_MOTION_RENDERING_VERSION = "1.0.0";
export const ANIMATION_DOMAIN_ID = "animation-knowledge";
export const MOTION_GRAPHICS_DOMAIN_ID = "motion-graphics-knowledge";
export const RENDERING_DOMAIN_ID = "rendering-knowledge";
export const ANIMATION_MOTION_RENDERING_SOURCE = "professional-animation-motion-rendering-knowledge";

export type AnimationTopicId =
  | "animation-fundamentals"
  | "principles-of-animation"
  | "timing"
  | "spacing"
  | "anticipation"
  | "squash-and-stretch"
  | "follow-through"
  | "secondary-action"
  | "staging"
  | "appeal"
  | "character-animation"
  | "product-animation";

export type MotionGraphicsTopicId =
  | "motion-design"
  | "motion-graphics-fundamentals"
  | "text-animation"
  | "logo-animation"
  | "icon-animation"
  | "ui-motion"
  | "motion-rhythm"
  | "motion-hierarchy"
  | "motion-timing"
  | "motion-style";

export type TransitionTopicId =
  | "cut"
  | "fade"
  | "dissolve"
  | "wipe"
  | "match-cut"
  | "luma-transition"
  | "shape-transition"
  | "zoom-transition"
  | "camera-transition"
  | "creative-transitions";

export type RenderingTopicId =
  | "rendering-fundamentals"
  | "render-pipeline"
  | "render-quality"
  | "resolution"
  | "frame-rate"
  | "bitrate"
  | "compression"
  | "video-codecs"
  | "color-space"
  | "hdr"
  | "export-settings"
  | "performance-optimization";

export type AmrRelatedDomainId =
  | "animation-knowledge"
  | "motion-graphics-knowledge"
  | "rendering-knowledge"
  | "video-production-knowledge"
  | "camera-knowledge"
  | "lighting-knowledge"
  | "storytelling-knowledge"
  | "video-editing-knowledge"
  | "marketing-knowledge";

export type AmrTopicId = AnimationTopicId | MotionGraphicsTopicId | TransitionTopicId | RenderingTopicId;

export interface ProfessionalAmrTopic {
  topicId: AmrTopicId;
  knowledgeId: string;
  name: string;
  title: string;
  description: string;
  professionalDefinition: string;
  purpose: string;
  bestPractices: string[];
  commonMistakes: string[];
  workflow: string[];
  professionalExamples: string[];
  relatedTopics: AmrTopicId[];
  relatedDomains: AmrRelatedDomainId[];
  keywords: string[];
  confidenceScore: number;
  qualityScore: number;
  metadata: {
    domainId: typeof ANIMATION_DOMAIN_ID | typeof MOTION_GRAPHICS_DOMAIN_ID | typeof RENDERING_DOMAIN_ID;
    category: "professional-animation" | "professional-motion-graphics" | "professional-transitions" | "professional-rendering";
    difficulty: "foundation" | "intermediate" | "advanced";
    expansionStep: 5;
    version: typeof PROFESSIONAL_ANIMATION_MOTION_RENDERING_VERSION;
    learningOnly: true;
    generatesVideo: false;
    generatesImages: false;
  };
}

export interface AmrDomainBridge {
  domainId: AmrRelatedDomainId;
  knowledgeId: string;
  title: string;
  description: string;
  relationshipEvidence: string;
}

export interface AiMeAmrAwareness {
  canRecommendAnimationStyles: boolean;
  canRecommendMotionGraphics: boolean;
  canRecommendRenderingSettings: boolean;
  canExplainRenderingDecisions: boolean;
  canRecommendExportSettings: boolean;
  canAnswerQuestions: boolean;
  animationTopicCount: number;
  motionGraphicsTopicCount: number;
  transitionTopicCount: number;
  renderingTopicCount: number;
  relationshipCount: number;
  averageConfidence: number;
  averageQuality: number;
  animationDomainReady: boolean;
  motionGraphicsDomainReady: boolean;
  renderingDomainReady: boolean;
  summary: string;
}

export interface AmrHealthReport {
  healthy: boolean;
  completenessScore: number;
  missingConcepts: string[];
  missingAnimationConcepts: string[];
  missingMotionConcepts: string[];
  missingRenderingConcepts: string[];
  duplicateKnowledge: string[];
  brokenRelationships: string[];
  issues: string[];
}

export interface AmrRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface AmrInstallResult {
  installed: boolean;
  animationInstalled: number;
  animationUpdated: number;
  motionInstalled: number;
  motionUpdated: number;
  transitionInstalled: number;
  transitionUpdated: number;
  renderingInstalled: number;
  renderingUpdated: number;
  bridgesInstalled: number;
  relationshipsCreated: number;
  animationPackSynced: boolean;
  motionPackSynced: boolean;
  renderingPackSynced: boolean;
  domainsMarkedReady: boolean;
  issues: string[];
}

export interface AmrRecommendation {
  available: boolean;
  topicId: string | null;
  name: string;
  reason: string;
  bestPractices: string[];
  workflow: string[];
  confidenceScore: number;
  alternatives: Array<{ name: string; reason: string }>;
  kind: "animation" | "motion-graphics" | "transitions" | "rendering" | "export" | "none";
}

export interface AmrExplainResult {
  available: boolean;
  knowledgeId: string | null;
  title: string;
  explanation: string;
  bestPractices: string[];
  confidenceScore: number;
  qualityScore: number;
  kind: "animation" | "motion-graphics" | "transitions" | "rendering" | "none";
}

export class ProfessionalAmrError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "ProfessionalAmrError";
  }
}

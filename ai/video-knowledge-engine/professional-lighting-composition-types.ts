/**
 * Professional Lighting & Composition Knowledge — Expansion Step 3 types.
 * Learning/organization only — does not generate images or videos.
 */

export const PROFESSIONAL_LIGHTING_COMPOSITION_VERSION = "1.0.0";
export const LIGHTING_DOMAIN_ID = "lighting-knowledge";
export const COMPOSITION_DOMAIN_ID = "composition-knowledge";
export const LIGHTING_COMPOSITION_KNOWLEDGE_SOURCE = "professional-lighting-composition-knowledge";

export type LightingTopicId =
  | "lighting-fundamentals"
  | "natural-lighting"
  | "artificial-lighting"
  | "three-point-lighting"
  | "key-light"
  | "fill-light"
  | "back-light"
  | "rim-light"
  | "soft-lighting"
  | "hard-lighting"
  | "high-key-lighting"
  | "low-key-lighting"
  | "color-temperature"
  | "white-balance"
  | "shadows"
  | "reflections"
  | "product-lighting"
  | "portrait-lighting"
  | "indoor-lighting"
  | "outdoor-lighting";

export type CompositionTopicId =
  | "rule-of-thirds"
  | "golden-ratio"
  | "leading-lines"
  | "framing"
  | "symmetry"
  | "balance"
  | "depth"
  | "negative-space"
  | "positive-space"
  | "headroom"
  | "look-room"
  | "eye-line"
  | "background-selection"
  | "foreground-elements"
  | "subject-placement"
  | "visual-hierarchy";

export type LightingCompositionRelatedDomainId =
  | "lighting-knowledge"
  | "composition-knowledge"
  | "camera-knowledge"
  | "video-production-knowledge"
  | "storytelling-knowledge"
  | "product-knowledge"
  | "rendering-knowledge"
  | "marketing-knowledge";

export interface ProfessionalLightingCompositionTopic {
  topicId: LightingTopicId | CompositionTopicId;
  knowledgeId: string;
  name: string;
  title: string;
  description: string;
  purpose: string;
  whenToUse: string[];
  whenNotToUse: string[];
  advantages: string[];
  limitations: string[];
  bestPractices: string[];
  commonMistakes: string[];
  professionalExamples: string[];
  relatedCameraTechniques: string[];
  relatedStorytellingTechniques: string[];
  relatedTopics: Array<LightingTopicId | CompositionTopicId>;
  relatedDomains: LightingCompositionRelatedDomainId[];
  keywords: string[];
  confidenceScore: number;
  qualityScore: number;
  metadata: {
    domainId: typeof LIGHTING_DOMAIN_ID | typeof COMPOSITION_DOMAIN_ID;
    category: "professional-lighting" | "professional-composition";
    difficulty: "foundation" | "intermediate" | "advanced";
    expansionStep: 3;
    version: typeof PROFESSIONAL_LIGHTING_COMPOSITION_VERSION;
    learningOnly: true;
    generatesImages: false;
    generatesVideo: false;
  };
}

export interface LightingCompositionDomainBridge {
  domainId: LightingCompositionRelatedDomainId;
  knowledgeId: string;
  title: string;
  description: string;
  relationshipEvidence: string;
}

export interface AiMeLightingCompositionAwareness {
  canRecommendLighting: boolean;
  canRecommendComposition: boolean;
  canExplainSelection: boolean;
  canCompareLighting: boolean;
  canCompareComposition: boolean;
  canAnswerQuestions: boolean;
  lightingTopicCount: number;
  compositionTopicCount: number;
  relationshipCount: number;
  averageConfidence: number;
  averageQuality: number;
  lightingDomainReady: boolean;
  compositionDomainReady: boolean;
  summary: string;
}

export interface LightingCompositionHealthReport {
  healthy: boolean;
  completenessScore: number;
  missingConcepts: string[];
  missingLightingTerminology: string[];
  missingCompositionTerminology: string[];
  duplicateKnowledge: string[];
  brokenRelationships: string[];
  issues: string[];
}

export interface LightingCompositionRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface LightingCompositionInstallResult {
  installed: boolean;
  lightingInstalled: number;
  lightingUpdated: number;
  compositionInstalled: number;
  compositionUpdated: number;
  bridgesInstalled: number;
  relationshipsCreated: number;
  lightingPackSynced: boolean;
  compositionPackSynced: boolean;
  domainsMarkedReady: boolean;
  issues: string[];
}

export interface LightingCompositionRecommendation {
  available: boolean;
  topicId: string | null;
  name: string;
  reason: string;
  whenToUse: string[];
  bestPractices: string[];
  confidenceScore: number;
  alternatives: Array<{ name: string; reason: string }>;
  kind: "lighting" | "composition" | "none";
}

export interface LightingCompositionCompareResult {
  topicA: string;
  topicB: string;
  kind: "lighting" | "composition" | "mixed" | "none";
  similarities: string[];
  differences: string[];
  recommendation: string;
  confidenceScore: number;
}

export interface LightingCompositionExplainResult {
  available: boolean;
  knowledgeId: string | null;
  title: string;
  explanation: string;
  bestPractices: string[];
  confidenceScore: number;
  qualityScore: number;
  kind: "lighting" | "composition" | "none";
}

export class ProfessionalLightingCompositionError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "ProfessionalLightingCompositionError";
  }
}

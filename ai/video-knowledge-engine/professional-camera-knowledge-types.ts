/**
 * Professional Camera & Camera Movement Knowledge — Expansion Step 2 types.
 * Learning/organization only — does not generate videos.
 */

export const PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION = "1.0.0";
export const CAMERA_DOMAIN_ID = "camera-knowledge";
export const CAMERA_MOVEMENT_DOMAIN_ID = "camera-movement-knowledge";
export const CAMERA_KNOWLEDGE_SOURCE = "professional-camera-knowledge";

export type CameraSettingTopicId =
  | "camera-fundamentals"
  | "camera-types"
  | "camera-sensors"
  | "camera-resolution"
  | "frame-rate"
  | "aspect-ratio"
  | "lens-types"
  | "focal-length"
  | "aperture"
  | "iso"
  | "shutter-speed"
  | "white-balance"
  | "focus"
  | "depth-of-field"
  | "exposure";

export type CameraMovementTopicId =
  | "static-shot"
  | "pan"
  | "tilt"
  | "zoom"
  | "dolly"
  | "truck"
  | "pedestal"
  | "crane"
  | "jib"
  | "gimbal"
  | "handheld"
  | "tracking-shot"
  | "follow-shot"
  | "orbit-shot"
  | "push-in"
  | "pull-out"
  | "reveal-shot"
  | "overhead-shot"
  | "low-angle"
  | "high-angle"
  | "eye-level"
  | "pov-shot";

export type CameraRelatedDomainId =
  | "camera-knowledge"
  | "camera-movement-knowledge"
  | "video-production-knowledge"
  | "lighting-knowledge"
  | "composition-knowledge"
  | "storytelling-knowledge"
  | "video-editing-knowledge"
  | "rendering-knowledge";

export interface ProfessionalCameraSettingTopic {
  topicId: CameraSettingTopicId;
  knowledgeId: string;
  title: string;
  description: string;
  professionalDefinition: string;
  bestPractices: string[];
  commonMistakes: string[];
  professionalWorkflow: string[];
  examples: string[];
  decisionRules: string[];
  relatedTopics: Array<CameraSettingTopicId | CameraMovementTopicId>;
  relatedDomains: CameraRelatedDomainId[];
  keywords: string[];
  confidenceScore: number;
  qualityScore: number;
  metadata: {
    domainId: typeof CAMERA_DOMAIN_ID;
    category: "professional-camera-settings";
    difficulty: "foundation" | "intermediate" | "advanced";
    expansionStep: 2;
    version: typeof PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION;
    learningOnly: true;
    generatesVideo: false;
  };
}

export interface ProfessionalCameraMovementTopic {
  topicId: CameraMovementTopicId;
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
  exampleUseCases: string[];
  relatedCameraSettings: CameraSettingTopicId[];
  relatedStorytellingTechniques: string[];
  relatedTopics: CameraMovementTopicId[];
  relatedDomains: CameraRelatedDomainId[];
  keywords: string[];
  confidenceScore: number;
  qualityScore: number;
  metadata: {
    domainId: typeof CAMERA_MOVEMENT_DOMAIN_ID;
    category: "professional-camera-movement";
    difficulty: "foundation" | "intermediate" | "advanced";
    expansionStep: 2;
    version: typeof PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION;
    learningOnly: true;
    generatesVideo: false;
  };
}

export interface CameraDomainBridge {
  domainId: CameraRelatedDomainId;
  knowledgeId: string;
  title: string;
  description: string;
  relationshipEvidence: string;
}

export interface AiMeCameraKnowledgeAwareness {
  canRecommendMovement: boolean;
  canExplainMovementChoice: boolean;
  canRecommendSettings: boolean;
  canCompareMovements: boolean;
  canAnswerCameraQuestions: boolean;
  settingTopicCount: number;
  movementTopicCount: number;
  relationshipCount: number;
  averageConfidence: number;
  averageQuality: number;
  cameraDomainReady: boolean;
  cameraMovementDomainReady: boolean;
  summary: string;
}

export interface CameraKnowledgeHealthReport {
  healthy: boolean;
  completenessScore: number;
  missingConcepts: string[];
  missingTerminology: string[];
  duplicateKnowledge: string[];
  brokenRelationships: string[];
  issues: string[];
}

export interface CameraKnowledgeRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface CameraKnowledgeInstallResult {
  installed: boolean;
  settingsInstalled: number;
  settingsUpdated: number;
  movementsInstalled: number;
  movementsUpdated: number;
  bridgesInstalled: number;
  relationshipsCreated: number;
  cameraPackSynced: boolean;
  movementPackSynced: boolean;
  domainsMarkedReady: boolean;
  issues: string[];
}

export interface CameraMovementRecommendation {
  available: boolean;
  movementId: string | null;
  name: string;
  reason: string;
  whenToUse: string[];
  relatedSettings: string[];
  confidenceScore: number;
  alternatives: Array<{ name: string; reason: string }>;
}

export interface CameraSettingsRecommendation {
  available: boolean;
  topicId: string | null;
  title: string;
  settingsGuidance: string[];
  decisionRules: string[];
  confidenceScore: number;
}

export interface CameraMovementCompareResult {
  movementA: string;
  movementB: string;
  similarities: string[];
  differences: string[];
  recommendation: string;
  confidenceScore: number;
}

export interface CameraKnowledgeExplainResult {
  available: boolean;
  knowledgeId: string | null;
  title: string;
  explanation: string;
  bestPractices: string[];
  confidenceScore: number;
  qualityScore: number;
  kind: "setting" | "movement" | "none";
}

export class ProfessionalCameraKnowledgeError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "ProfessionalCameraKnowledgeError";
  }
}

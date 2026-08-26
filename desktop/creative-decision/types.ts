/** Phase 6 Step 3 — AI Decision, Smart Suggestions & Creative Correction Engine types. */

import type { FeedbackCategory } from "../creative-review/types";

export type IssueCategory =
  | "PRODUCT_VISIBILITY"
  | "VISUAL_QUALITY"
  | "AUDIO_QUALITY"
  | "VOICE_CLARITY"
  | "MUSIC_BALANCE"
  | "TEXT_READABILITY"
  | "CTA_VISIBILITY"
  | "TIMING"
  | "SCENE_FLOW"
  | "BRAND_CONSISTENCY"
  | "MARKETING_ALIGNMENT"
  | "SUBTITLE_QUALITY"
  | "PRODUCT_INFORMATION"
  | "CLAIM_SAFETY"
  | "OUTPUT_QUALITY";

export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type RecommendationGroup = "MUST_FIX" | "SHOULD_IMPROVE" | "OPTIONAL";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RecommendationStatus =
  | "DETECTED"
  | "RECOMMENDED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "IN_PROGRESS"
  | "APPLIED"
  | "VERIFIED"
  | "REJECTED"
  | "FAILED"
  | "IGNORED";

export type CorrectionPlanStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "IN_PROGRESS"
  | "APPLIED"
  | "FAILED"
  | "CANCELLED";

export type DecisionErrorClass =
  | "ANALYSIS_ERROR"
  | "RECOMMENDATION_ERROR"
  | "CORRECTION_PLAN_ERROR"
  | "VERSION_ERROR"
  | "PRODUCTION_ERROR"
  | "QC_ERROR"
  | "VERIFICATION_ERROR"
  | "DATABASE_ERROR"
  | "AI_SERVICE_ERROR";

export interface DetectedIssue {
  issueId: string;
  category: IssueCategory;
  severity: IssueSeverity;
  priorityScore: number;
  title: string;
  observation: string;
  evidence: string[];
  sceneId: string | null;
  sceneNumber: number | null;
  fromUserFeedback: boolean;
  feedbackId: string | null;
}

export interface SmartRecommendation {
  recommendationId: string;
  issueId: string;
  status: RecommendationStatus;
  group: RecommendationGroup;
  category: IssueCategory;
  severity: IssueSeverity;
  priorityScore: number;
  what: string;
  why: string;
  where: string;
  expectedResult: string;
  observation: string;
  confidence: number | null;
  confidenceLabel: "AVAILABLE" | "NOT AVAILABLE";
  risk: RiskLevel;
  riskReason: string;
  sceneId: string | null;
  conflicts: ConflictNotice[];
  selected: boolean;
  ignoredAt: string | null;
  ignoreReason: string | null;
  appliedVersion: string | null;
  createdAt: string;
  updatedAt: string;
  feedbackCategory: FeedbackCategory;
}

export interface ConflictNotice {
  conflictId: string;
  kind: "USER_VS_MARKETING" | "CLAIM_SAFETY" | "PRODUCT_DATA" | "QC_RULE" | "BLUEPRINT";
  message: string;
  options: Array<{ id: string; label: string }>;
}

export interface CorrectionChangeItem {
  itemId: string;
  recommendationId: string;
  sceneId: string | null;
  sceneLabel: string;
  change: string;
  category: IssueCategory;
  dependencies: string[];
}

export interface ImpactAnalysis {
  affected: string[];
  notAffected: string[];
  expectedProcessing: string;
  partialSupported: boolean;
  partialNote: string;
}

export interface VerificationResult {
  available: boolean;
  beforeNote: string;
  afterNote: string;
  issueResolved: boolean | null;
  qcOverallBefore: string | null;
  qcOverallAfter: string | null;
  message: string;
}

export interface CreativeCorrectionPlan {
  planId: string;
  projectId: string;
  productionId: string;
  sourceVersion: string;
  targetVersion: string;
  status: CorrectionPlanStatus;
  changes: CorrectionChangeItem[];
  reason: string;
  expectedResult: string;
  dependencies: string[];
  risk: RiskLevel;
  riskReason: string;
  impact: ImpactAnalysis;
  conflicts: ConflictNotice[];
  claimSafetyBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  resultNote: string | null;
  verification: VerificationResult | null;
}

export interface DecisionErrorRecord {
  errorId: string;
  stage: DecisionErrorClass;
  message: string;
  timestamp: string;
  recoveryAction: string;
}

export interface DecisionAuditEntry {
  id: string;
  at: string;
  action:
    | "ANALYSIS_STARTED"
    | "ANALYSIS_COMPLETED"
    | "RECOMMENDATION_CREATED"
    | "RECOMMENDATION_VIEWED"
    | "RECOMMENDATION_ACCEPTED"
    | "RECOMMENDATION_IGNORED"
    | "CORRECTION_PLAN_CREATED"
    | "CORRECTION_APPROVED"
    | "CORRECTION_STARTED"
    | "CORRECTION_COMPLETED"
    | "CORRECTION_FAILED"
    | "VERIFICATION_COMPLETED"
    | "ERROR";
  detail: string;
  productionId: string | null;
  versionLabel: string | null;
  result: "ok" | "error" | "pending";
}

export interface DecisionAnalysisSnapshot {
  analysisId: string;
  projectId: string;
  productionId: string;
  versionLabel: string;
  startedAt: string;
  completedAt: string | null;
  issues: DetectedIssue[];
  recommendations: SmartRecommendation[];
  mustFix: string[];
  shouldImprove: string[];
  optional: string[];
  contextFingerprint: string;
  marketingSummary: string | null;
  platformHints: string[];
  language: string | null;
  creativeScoreCurrent: string | null;
  creativeScoreExpected: string | null;
}

export interface DecisionUiSnapshot {
  version: 1;
  available: boolean;
  unavailableReason: string | null;
  analyzing: boolean;
  analysis: DecisionAnalysisSnapshot | null;
  recommendations: SmartRecommendation[];
  activePlan: CreativeCorrectionPlan | null;
  plans: CreativeCorrectionPlan[];
  history: DecisionAuditEntry[];
  errors: DecisionErrorRecord[];
  preferences: ProjectPreferenceMemory;
  recommendation: string;
  updatedAt: string;
}

export interface ProjectPreferenceMemory {
  preferShorterVideos: boolean;
  preferStrongerCta: boolean;
  preferMinimalMusic: boolean;
  preferProductCentered: boolean;
  notes: string[];
  updatedAt: string | null;
}

export const DECISION_STORE_KEY = "kwizera.creative-decision.v1";
export const DECISION_AUDIT_KEY = "kwizera.creative-decision.audit.v1";
export const DECISION_PREFS_KEY = "kwizera.creative-decision.prefs.v1";
export const DECISION_HANDOFF_KEY = "kwizera.creative-decision.handoff.v1";

export const emptyPreferences = (): ProjectPreferenceMemory => ({
  preferShorterVideos: false,
  preferStrongerCta: false,
  preferMinimalMusic: false,
  preferProductCentered: false,
  notes: [],
  updatedAt: null,
});

/** Phase 6 Step 4 — Project creative memory, learning & integration types. */

export type MemoryCategory =
  | "PROJECT_MEMORY"
  | "CREATIVE_MEMORY"
  | "REVIEW_MEMORY"
  | "DECISION_MEMORY"
  | "PREFERENCE_MEMORY"
  | "PRODUCTION_MEMORY"
  | "VERSION_MEMORY";

export type MemoryImportance = "HIGH" | "MEDIUM" | "LOW";
export type MemorySource = "USER" | "AI" | "SYSTEM" | "REVIEW" | "PRODUCTION" | "QC" | "VERSION";
export type MemoryConfidence = "CONFIRMED" | "INFERRED" | "UNKNOWN";
export type MemoryLifecycle = "ACTIVE" | "OUTDATED" | "ARCHIVED";

export type WorkflowPhase =
  | "DRAFT"
  | "INPUT_READY"
  | "ANALYZING"
  | "PLANNING"
  | "PRODUCING"
  | "RENDERING"
  | "QC"
  | "REVIEW"
  | "APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type NextActionKind =
  | "UPLOAD"
  | "ANALYZE"
  | "REVIEW"
  | "FIX"
  | "RENDER"
  | "QC"
  | "APPROVE"
  | "EXPORT"
  | "OPEN_REVIEW"
  | "VIEW_QC"
  | "START_PRODUCTION"
  | "NONE";

export interface CreativeMemoryEntry {
  memoryId: string;
  projectId: string;
  category: MemoryCategory;
  content: string;
  importance: MemoryImportance;
  source: MemorySource;
  confidence: MemoryConfidence;
  lifecycle: MemoryLifecycle;
  topic: string;
  versionLabel: string | null;
  relatedRecommendationId: string | null;
  decision: "APPROVED" | "REJECTED" | "IGNORED" | "APPLIED" | "FAILED" | null;
  createdAt: string;
  updatedAt: string;
  disabled: boolean;
}

export interface CreativeProfile {
  projectId: string;
  projectName: string;
  visualStyle: string | null;
  pacing: string | null;
  productPresentation: string | null;
  ctaStyle: string | null;
  musicStyle: string | null;
  voiceStyle: string | null;
  language: string | null;
  platform: string | null;
  audience: string | null;
  marketingGoal: string | null;
  populatedFrom: string[];
}

export interface StartupSummary {
  projectName: string;
  productionStatus: string;
  currentVersion: string;
  reviewStatus: string;
  recommendationCount: number;
  highPriorityCount: number;
  nextAction: NextActionKind;
  nextActionLabel: string;
  workflowPhase: WorkflowPhase;
  lines: string[];
}

export interface SmartNextAction {
  kind: NextActionKind;
  label: string;
  workspace: string | null;
  reason: string;
  primary: boolean;
}

export interface MemoryContextPacket {
  projectId: string;
  productionId: string;
  versionLabel: string;
  reviewStatus: string;
  relevant: CreativeMemoryEntry[];
  profile: CreativeProfile | null;
  transparencyNote: string | null;
  userRequest: string | null;
}

export interface AutomationRuleResult {
  ruleId: string;
  triggered: boolean;
  action: string;
  requiresApproval: boolean;
  executed: boolean;
  detail: string;
}

export interface IntegrationAuditEntry {
  id: string;
  at: string;
  action:
    | "MEMORY_CREATED"
    | "MEMORY_UPDATED"
    | "MEMORY_ARCHIVED"
    | "MEMORY_DISABLED"
    | "RECOMMENDATION_REUSED"
    | "PREFERENCE_UPDATED"
    | "AI_ACTION_PROPOSED"
    | "AI_ACTION_APPROVED"
    | "AI_ACTION_EXECUTED"
    | "AUTOMATION_TRIGGERED"
    | "AUTOMATION_COMPLETED"
    | "AUTOMATION_FAILED"
    | "FOLLOW_UP"
    | "ERROR";
  detail: string;
  projectId: string | null;
  result: "ok" | "error" | "pending";
}

export interface CreativeIntelligenceSnapshot {
  version: 1;
  available: boolean;
  unavailableReason: string | null;
  memories: CreativeMemoryEntry[];
  profile: CreativeProfile | null;
  summary: StartupSummary | null;
  nextAction: SmartNextAction | null;
  workflowPhase: WorkflowPhase;
  lastAutomation: AutomationRuleResult | null;
  audit: IntegrationAuditEntry[];
  recommendation: string;
  phase6Complete: boolean;
  updatedAt: string;
}

export const CREATIVE_MEMORY_KEY = "kwizera.creative-memory.v1";
export const CREATIVE_MEMORY_AUDIT_KEY = "kwizera.creative-memory.audit.v1";
export const PHASE6_COMPLETE_KEY = "kwizera.phase-6.complete.v1";

import type { TeachingMode, TeachingRecordKind, TrainingScope, TrainingStrategy, TrainingTarget } from "./training-catalog.js";

export type ValidationState = "PENDING" | "VALID" | "INVALID" | "NEEDS_REVIEW";
export type IssueSeverity = "ERROR" | "REVIEW" | "INFO";

export interface ValidationIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
}

export interface GuidanceValue {
  key: string;
  value: number;
  note?: string;
}

export type MediaRole = "SOURCE" | "REFERENCE_RESULT" | "BEFORE" | "AFTER" | "AUDIO" | "VIDEO" | "IMAGE" | "DOCUMENT";
export type MediaKind = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";

export interface AudioMeasurement {
  durationSec: number;
  sampleRate: number | null;
  channels: number | null;
  codec: string | null;
  bpm: number | null;
  tempoConfidence: number;
  tempoStatus: string;
  beatCount: number;
  downbeatCount: number;
  firstBeats: number[];
  sections: Array<{ label: string; start: number; end: number }>;
  rmsDbfs: number | null;
  peakDbfs: number | null;
  clippedRatio: number;
  silent: boolean;
}

export interface MediaAnalysis {
  kind: MediaKind;
  width?: number;
  height?: number;
  aspectRatio?: string;
  durationSec?: number;
  codec?: string | null;
  hasAudioStream?: boolean;
  sceneChanges?: number[];
  sceneCount?: number;
  meanShotSec?: number | null;
  audio?: AudioMeasurement | null;
  document?: { pages: number; pagesWithText: number; headings: string[]; chars: number; format: string };
  notes: string[];
}

export interface TeachingMediaRef {
  mediaId: string;
  role: MediaRole;
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  /** Where the bytes live — "training-store" (content-addressed) or a referenced project asset. Paths are never exposed. */
  storage: "training-store" | "project-asset";
  projectAsset?: { projectId: string; assetId: string };
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  analysis: MediaAnalysis | null;
  error: { code: string; message: string } | null;
}

export interface CodeContent {
  language: string;
  framework?: string;
  topic?: string;
  version?: string;
  source?: string;
  expectedBehavior?: string;
  code: string;
}

export type EvaluationCase =
  | { check: "PRODUCT_VISIBILITY"; sourceWidth: number; sourceHeight: number; aspect: "9:16" | "16:9" | "1:1" | "4:5" }
  | { check: "AUDIO_COVERAGE"; sourceDurationSec: number; targetDurationSec: number; bpm?: number | null; voice?: boolean }
  | { check: "TYPOGRAPHY_HIERARCHY"; productName: string; price?: string; cta?: string; aspect: "9:16" | "16:9" | "1:1" | "4:5" }
  | { check: "RETRIEVAL"; query: string }
  | { check: "TEXT_GROUNDING"; input: string; output: string };

export interface TeachingRecord {
  recordId: string;
  datasetId: string;
  kind: TeachingRecordKind;
  title: string;
  text: string;
  instruction: string;
  input: string;
  expectedOutput: string;
  explanation: string;
  rules: string[];
  code: CodeContent | null;
  document: { fileName: string; mimeType: string; markdown: string; pages: number; headings: string[]; chars: number; format: string } | null;
  guidance: GuidanceValue[];
  media: TeachingMediaRef[];
  /** Admin-declared properties of reference media; compared with measurements during evaluation. */
  declared: { aspectRatio?: string; durationSec?: number; bpm?: number } | null;
  evalCase: EvaluationCase | null;
  tags: string[];
  contentHash: string;
  validation: { state: ValidationState; issues: ValidationIssue[]; checkedAt: string | null };
  review: { decision: "APPROVED" | "REJECTED"; by: string; at: string; note: string } | null;
  /** Credential types that were redacted at intake; keeps the record INVALID even though the value is gone. */
  secretsRedacted?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type VersionStatus = "VALID" | "INVALID" | "NEEDS_REVIEW";
export type ActivationState = "ACTIVE" | "INACTIVE" | "NEVER_ACTIVATED";

export interface DatasetVersion {
  datasetId: string;
  version: number;
  status: VersionStatus;
  /** Frozen copies of the records at publish time; never modified afterwards. */
  records: TeachingRecord[];
  recordCount: number;
  contentHash: string;
  validation: { issues: ValidationIssue[]; counts: Record<ValidationState, number> };
  guidance: GuidanceValue[];
  strategy: TrainingStrategy;
  note: string;
  publishedBy: string;
  publishedAt: string;
  evaluationIds: string[];
  latestEvaluation: { evaluationId: string; status: EvaluationStatus; at: string } | null;
  activation: ActivationState;
  knowledgeSourceId: string | null;
  patternRef: string | null;
}

export interface TeachingDataset {
  datasetId: string;
  key: string;
  name: string;
  description: string;
  target: TrainingTarget;
  capability: string;
  mode: TeachingMode;
  scope: TrainingScope;
  projectId: string | null;
  draftRecordIds: string[];
  versions: number[];
  activeVersion: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type TrainingJobKind = "PROCESS_MEDIA" | "PUBLISH" | "EVALUATE" | "ACTIVATE" | "DEACTIVATE" | "ROLLBACK" | "MODEL_TRAINING";
export type TrainingJobStatus = "QUEUED" | "PREPARING" | "RUNNING" | "EVALUATING" | "COMPLETED" | "FAILED" | "CANCELLED" | "BLOCKED";

export interface TrainingJob {
  jobId: string;
  kind: TrainingJobKind;
  datasetId: string | null;
  version: number | null;
  recordId: string | null;
  status: TrainingJobStatus;
  stages: Array<{ stage: string; at: string; note?: string }>;
  counts: { total: number; processed: number; failed: number };
  error: { code: string; message: string } | null;
  result: Record<string, unknown> | null;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type EvaluationStatus = "PASSED" | "FAILED";
export type CheckStatus = "PASSED" | "FAILED" | "SKIPPED";

export interface EvaluationCheck {
  id: string;
  label: string;
  category: "STRUCTURE" | "RETRIEVAL" | "GUIDANCE" | "ISOLATION" | "VIDEO" | "AUDIO" | "TYPOGRAPHY" | "TEXT" | "CODE" | "MEDIA" | "REGRESSION";
  status: CheckStatus;
  detail: string;
  recordId?: string;
  measured?: Record<string, unknown>;
}

export interface TeachingEvaluation {
  evaluationId: string;
  datasetId: string;
  version: number;
  capability: string;
  status: EvaluationStatus;
  checks: EvaluationCheck[];
  summary: { passed: number; failed: number; skipped: number };
  configuration: Record<string, unknown>;
  evaluatedBy: string;
  createdAt: string;
}

export interface ActivationRecord {
  activationId: string;
  datasetId: string;
  version: number;
  action: "ACTIVATE" | "DEACTIVATE" | "ROLLBACK";
  previousVersion: number | null;
  strategy: TrainingStrategy;
  target: TrainingTarget;
  capability: string;
  scope: TrainingScope;
  projectId: string | null;
  evaluationId: string | null;
  delivery: Array<{ channel: "KNOWLEDGE_BASE" | "CREATIVE_PATTERNS"; ref: string | null; detail: string }>;
  configuration: Record<string, unknown>;
  by: string;
  at: string;
  /** Always false: activation delivers knowledge; it never changes model weights. */
  modelWeightsChanged: false;
}

export interface TrainingProfile {
  profileId: string;
  name: string;
  description: string;
  capability: string;
  entries: Array<{ datasetId: string; version: number }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

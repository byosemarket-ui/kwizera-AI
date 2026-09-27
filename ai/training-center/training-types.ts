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
  /** Phase 18B detail (optional for records measured before it existed). */
  beatTimes?: number[];
  downbeatTimes?: number[];
  energyTimeline?: Array<{ start: number; end: number; energy: number }>;
  energyTransitions?: Array<{ time: number; type: string }>;
  silences?: Array<{ start: number; end: number }>;
  fadeInSec?: number | null;
  fadeOutSec?: number | null;
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
  /** Present when the record was learned from source material by a teaching session (Phase 18B). */
  knowledge?: RecordKnowledge;
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
  /** Archived datasets are hidden from the default lists (nothing is deleted); active datasets cannot be archived. */
  archived?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type TrainingJobKind = "PROCESS_MEDIA" | "PUBLISH" | "EVALUATE" | "ACTIVATE" | "DEACTIVATE" | "ROLLBACK" | "MODEL_TRAINING" | "TEACHING_SESSION";
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
  /** Fine-grained progress of teaching sessions; percent is null unless the work is countable. */
  progress?: SessionProgress;
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
  category: "STRUCTURE" | "RETRIEVAL" | "GUIDANCE" | "ISOLATION" | "VIDEO" | "AUDIO" | "TYPOGRAPHY" | "TEXT" | "CODE" | "MEDIA" | "REGRESSION" | "KNOWLEDGE";
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

// ---------- Phase 18B: teaching sessions, source library, learned knowledge ----------

export type TeachingType = "KNOWLEDGE" | "EXAMPLE" | "STYLE" | "INSTRUCTION" | "WORKFLOW" | "BEST_PRACTICE" | "PATTERN" | "MULTIMODAL_EXAMPLE";
export type SourceKind = "TEXT" | "DOCUMENT" | "BOOK" | "IMAGE" | "VIDEO" | "AUDIO" | "CODE" | "URL";
export type SessionSourceType = SourceKind | "MULTIPLE";
export type RetentionPolicy = "KEEP_SOURCE" | "DELETE_AFTER_SUCCESSFUL_EXTRACTION" | "ARCHIVE_SOURCE";
export type SourceStatus = "STORED" | "PROCESSING" | "PROCESSED" | "FAILED" | "DELETED" | "ARCHIVED";

export interface TeachingSource {
  sourceId: string;
  kind: SourceKind;
  title: string;
  description: string;
  fileName: string;
  mimeType: string;
  format: string;
  sizeBytes: number;
  /** SHA-256 of the original bytes; kept after the file is deleted so re-uploads are recognised. */
  contentHash: string;
  storage: "training-store" | "url" | "none";
  url: string | null;
  target: TrainingTarget;
  capability: string;
  scope: TrainingScope;
  projectId: string | null;
  retention: RetentionPolicy;
  retained: boolean;
  status: SourceStatus;
  measured: { pages?: number; chapters?: number; sections?: number; durationSec?: number; width?: number; height?: number; lines?: number; rows?: number };
  knowledgeExtracted: number;
  sessionIds: string[];
  error: { code: string; message: string } | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type KnowledgeType = "rule" | "principle" | "example" | "pattern" | "workflow" | "style" | "constraint" | "heuristic" | "relationship" | "multimodal_pattern";
export type NoveltyClass = "KNOWN" | "NEW" | "PARTIALLY_NEW" | "DUPLICATE" | "CONTRADICTORY" | "LOW_CONFIDENCE" | "REQUIRES_REVIEW";
export type ExtractionMethod = "RULE_BASED" | "MEASURED" | "AI_ASSISTED";

export interface SourceLocation {
  sourceId: string;
  sourceTitle: string;
  kind: SourceKind;
  page?: number;
  chapter?: string;
  section?: string;
  paragraph?: number;
  line?: number;
  scene?: number;
  startSec?: number;
  endSec?: number;
  /** Human-readable, e.g. "Page 3 · Composition" or "Scene 7, 00:18–00:21". */
  label: string;
}

export interface KnowledgeEvidence {
  kind: "QUOTE" | "MEASUREMENT" | "VISION" | "CODE";
  text: string;
  location?: string;
}

export interface KnowledgeRelationship {
  type: "EXTENDS" | "SUPPORTS" | "CONTRADICTS" | "DUPLICATES" | "CORRELATES";
  targetId: string;
  targetTitle: string;
  targetKind: "SESSION" | "DATASET" | "KNOWLEDGE_BASE";
  similarity?: number;
}

export interface NoveltyAssessment {
  class: NoveltyClass;
  similarity: number;
  method: "LEXICAL_SEMANTIC";
  matched: { id: string; title: string; kind: "SESSION" | "DATASET" | "KNOWLEDGE_BASE"; excerpt: string } | null;
  reason: string;
}

/** A learned knowledge unit (candidate until committed to a dataset). */
export interface KnowledgeRecord {
  id: string;
  sessionId: string;
  targetAI: TrainingTarget;
  capability: string;
  knowledgeType: KnowledgeType;
  title: string;
  statement: string;
  structuredData: Record<string, unknown>;
  sourceIds: string[];
  sourceLocations: SourceLocation[];
  confidence: number;
  evidence: KnowledgeEvidence[];
  tags: string[];
  relationships: KnowledgeRelationship[];
  method: ExtractionMethod;
  novelty: NoveltyAssessment;
  /** False when the admin's instructions focus elsewhere; such items are shown but not recommended. */
  inScope: boolean;
  scopeNote: string | null;
  suggestedGuidance: GuidanceValue[];
  flags: string[];
  recommended: boolean;
  decision: "PENDING" | "ACCEPTED" | "REJECTED";
  decisionBy: string | null;
  decisionAt: string | null;
  committedRecordId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface RecordKnowledge {
  sessionId: string;
  knowledgeId: string;
  knowledgeType: KnowledgeType;
  statement: string;
  structuredData: Record<string, unknown>;
  sourceIds: string[];
  sourceLocations: SourceLocation[];
  evidence: KnowledgeEvidence[];
  confidence: number;
  method: ExtractionMethod;
  novelty: NoveltyAssessment;
  relationships: KnowledgeRelationship[];
  /** Admin accepted a CONTRADICTORY / REQUIRES_REVIEW item; the record still needs review approval before publishing. */
  conflictAccepted: boolean;
  revisions: Array<{ at: string; by: string; action: "CREATED" | "MERGED_PROVENANCE" | "CONFLICT_ACCEPTED"; note: string }>;
}

export type SessionStatus = "QUEUED" | "ANALYZING" | "READY_FOR_REVIEW" | "COMMITTED" | "FAILED" | "CANCELLED";

export type SessionStage =
  | "QUEUED" | "UPLOADED" | "VALIDATING_SOURCE" | "EXTRACTING_METADATA" | "EXTRACTING_TEXT" | "SAMPLING_FRAMES"
  | "DETECTING_SCENES" | "EXTRACTING_AUDIO" | "TRANSCRIBING" | "ANALYZING_VISUALS" | "ANALYZING_AUDIO" | "ANALYZING_SYNC"
  | "EXTRACTING_KNOWLEDGE" | "CHECKING_NOVELTY" | "DEDUPLICATING" | "VALIDATING" | "READY_FOR_REVIEW"
  | "CREATING_DATASET_VERSION" | "EVALUATING" | "READY_TO_ACTIVATE" | "ACTIVATING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface SessionProgress {
  stage: SessionStage;
  stageLabel: string;
  /** Countable work: completed / total units (e.g. analysis steps, frames, pages). */
  completed: number;
  total: number;
  unit: string;
  /** Only when completed/total are measured; never 100 before the job has finished. */
  percent: number | null;
  currentSource: string | null;
  currentItem: string | null;
  startedAt: string | null;
  elapsedSec: number;
  /** Only when a reliable estimate exists (same-kind sources with measured durations). */
  etaSec: number | null;
  counts: { extracted: number; new: number; partiallyNew: number; known: number; duplicate: number; contradictory: number; lowConfidence: number; requiresReview: number };
}

export interface TeachingSession {
  sessionId: string;
  targetAI: TrainingTarget;
  capability: string;
  teachingType: TeachingType;
  sourceType: SessionSourceType;
  sourceAssetIds: string[];
  sourceReferences: Array<{ sourceId: string; kind: SourceKind; title: string; fileName: string }>;
  instructions: string;
  requestedKnowledgeScope: { focus: string[]; types: KnowledgeType[]; exclude: string[]; mediaFocus: string[] };
  scope: TrainingScope;
  projectId: string | null;
  status: SessionStatus;
  progress: SessionProgress;
  analysis: {
    ai: { vision: string; reasoning: string; transcription: string };
    notes: string[];
    perSource: Array<{ sourceId: string; title: string; status: "PROCESSED" | "FAILED"; notes: string[]; unavailable: string[]; summary: Record<string, unknown> }>;
  };
  jobId: string | null;
  datasetId: string | null;
  datasetVersionId: string | null;
  evaluationId: string | null;
  activationId: string | null;
  error: { code: string; message: string } | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

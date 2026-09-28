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
  /** Only a reliable tempo (tempoStatus "available"); consumers may treat any non-null value as measured. */
  bpm: number | null;
  /** Phase 20 — the unreliable estimate, for Admin inspection only; never used as a beat grid or stated as knowledge. */
  bpmCandidate?: number | null;
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
  /** Phase 20 — analysis steps that threw (the others were still measured). */
  failed?: string[];
}

/** Phase 20 — per-capability outcome for one media source; UNAVAILABLE is never filled with invented values. */
export type MediaCapabilityStatus = "EXECUTED" | "NO_RESULT" | "LOW_CONFIDENCE" | "UNAVAILABLE" | "FAILED";
export interface MediaCapabilityEntry {
  capability: string;
  implemented: boolean;
  executable: boolean;
  status: MediaCapabilityStatus;
  detail: string;
}

/** Phase 20 — what the canonical ingestion found and did (no paths, no identifiers). */
export interface MediaIngestionSummary {
  tier: "SUPPORTED_DIRECTLY" | "SUPPORTED_AFTER_NORMALIZATION";
  sniffed: string;
  container: string | null;
  durationSec: number | null;
  durationSource: "FORMAT" | "STREAM" | null;
  video: { codec: string | null; width: number; height: number; fps: number | null; variableFrameRate: boolean; pixFmt: string | null; rotation: number } | null;
  audio: { codec: string | null; sampleRate: number | null; channels: number | null } | null;
  normalization: null | {
    reasons: string[];
    description: string;
    target: "MP4_H264_AAC" | "FLAC";
    derivative: { container: string | null; durationSec: number | null; codec: string | null; width: number | null; height: number | null; fps: number | null; sampleRate: number | null };
    seconds: number;
    derivativeRetained: false;
  };
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
  /** Phase 20 — canonical ingestion outcome and capability matrix (absent for analyses stored earlier). */
  ingestion?: MediaIngestionSummary;
  capabilities?: MediaCapabilityEntry[];
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
  delivery: Array<{ channel: "KNOWLEDGE_BASE" | "CREATIVE_PATTERNS" | "LEARNED_CREATIVE_PATTERNS" | "RUNTIME_VERIFICATION" | "SOURCE_RETENTION"; ref: string | null; detail: string }>;
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
/**
 * DELETE_SOURCE_AFTER_LEARNING deletes the stored file only after the knowledge learned from it is in an evaluated,
 * activated dataset version. DELETE_AFTER_SUCCESSFUL_EXTRACTION is the pre-18C name; it is accepted and stored as
 * DELETE_SOURCE_AFTER_LEARNING (the file is no longer deleted at extraction time).
 */
export type RetentionPolicy = "KEEP_SOURCE" | "DELETE_SOURCE_AFTER_LEARNING" | "DELETE_AFTER_SUCCESSFUL_EXTRACTION" | "ARCHIVE_SOURCE";

export type RetentionState = "RETAINED" | "PENDING_ACTIVATION" | "DELETED_AFTER_LEARNING" | "ARCHIVED" | "DELETED_BY_ADMIN";
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
  /** Phase 18C — where the retention policy stands (optional for sources stored earlier). */
  retentionState?: RetentionState;
  retentionNote?: string | null;
  status: SourceStatus;
  measured: { pages?: number; chapters?: number; sections?: number; durationSec?: number; width?: number; height?: number; lines?: number; rows?: number };
  /** Phase 20 — set when the source was chosen by task-aware online research. */
  research?: ResearchSourceMeta;
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
  /** Phase 20 — citation for online sources (query string removed) and when it was retrieved. */
  url?: string;
  retrievedAt?: string;
}

/** Phase 20 — online research readiness; checked without exposing credentials or provider identifiers. */
export interface OnlinePreflight {
  state: "ONLINE_RESEARCH_AVAILABLE" | "ONLINE_RESEARCH_UNAVAILABLE";
  requested: boolean;
  checkedAt: string;
  checks: Array<{ check: string; ok: boolean | null; detail: string }>;
}

export interface ResearchSourceMeta {
  registryId: string;
  publisher: string;
  topics: string[];
  /** Why the planner picked this page for the task (target, media, gaps). */
  reason: string;
  license: string;
  freshnessDays: number;
  retrievedAt: string | null;
  contentHash: string | null;
  previousContentHash: string | null;
}

export interface SessionOnlineResearch {
  preflight: OnlinePreflight;
  requested: boolean;
  planned: Array<{ registryId: string; url: string; publisher: string; topics: string[]; reason: string }>;
  fetched: number;
  failed: Array<{ registryId: string; code: string; message: string }>;
  records: number;
  note: string;
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
  method: "LEXICAL_SEMANTIC" | "STRUCTURAL_PATTERN";
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
  /** Phase 18C (optional for records created earlier). */
  domain?: string;
  /** English canonical form used for retrieval; equals `statement` when the source is English or not translated. */
  canonicalStatement?: string;
  language?: KnowledgeLanguage;
  /** The statement and evidence exactly as extracted from the source, before any normalisation. */
  originalEvidence?: { statement: string; quotes: string[] };
  timestampRange?: { startSec: number; endSec: number } | null;
}

export interface KnowledgeLanguage {
  code: string;
  name: string;
  confidence: number;
  normalization: "ORIGINAL_ENGLISH" | "TRANSLATED_BY_AI" | "NOT_TRANSLATED" | "GENERATED_FROM_MEASUREMENT";
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
  revisions: Array<{ at: string; by: string; action: "CREATED" | "MERGED_PROVENANCE" | "CONFLICT_ACCEPTED" | "ENRICHED"; note: string; previousStatement?: string }>;
  /** Phase 18C (optional for records created earlier). */
  domain?: string;
  canonicalStatement?: string;
  language?: KnowledgeLanguage;
  originalEvidence?: { statement: string; quotes: string[] };
  timestampRange?: { startSec: number; endSec: number } | null;
}

export type SessionStatus = "QUEUED" | "ANALYZING" | "READY_FOR_REVIEW" | "COMMITTED" | "FAILED" | "CANCELLED";

export type SessionStage =
  | "QUEUED" | "UPLOADED" | "VALIDATING_SOURCE" | "EXTRACTING_METADATA" | "EXTRACTING_TEXT" | "SAMPLING_FRAMES"
  | "DETECTING_SCENES" | "EXTRACTING_AUDIO" | "TRANSCRIBING" | "ANALYZING_VISUALS" | "ANALYZING_AUDIO" | "ANALYZING_SYNC"
  | "EXTRACTING_KNOWLEDGE" | "CHECKING_NOVELTY" | "DEDUPLICATING" | "VALIDATING" | "READY_FOR_REVIEW"
  | "CREATING_DATASET_VERSION" | "EVALUATING" | "READY_TO_ACTIVATE" | "ACTIVATING" | "COMPLETED" | "FAILED" | "CANCELLED"
  // Phase 18C — canonical multimodal stages
  | "UPLOADING" | "VALIDATING" | "MEDIA_METADATA" | "SCENE_DETECTION" | "FRAME_ANALYSIS" | "VISION_ANALYSIS" | "AUDIO_ANALYSIS"
  | "TRANSCRIPT_ANALYSIS" | "TEXT_ANALYSIS" | "MOTION_ANALYSIS" | "TRANSITION_ANALYSIS" | "CREATIVE_PATTERN_ANALYSIS"
  | "KNOWLEDGE_EXTRACTION" | "LANGUAGE_NORMALIZATION" | "NOVELTY_CHECK" | "CONSOLIDATION" | "VALIDATION"
  // Phase 18D — per-modality stages (each reports what was actually measured, or why it is unavailable)
  | "SYNC_ANALYSIS" | "SPEECH_ANALYSIS" | "AUDIO_METADATA" | "WAVEFORM_ANALYSIS" | "BPM_ANALYSIS" | "BEAT_ANALYSIS" | "ENERGY_ANALYSIS"
  | "PATTERN_ANALYSIS" | "IMAGE_METADATA" | "COMPOSITION_ANALYSIS" | "TYPOGRAPHY_ANALYSIS" | "DESIGN_PATTERN_ANALYSIS"
  // Phase 20
  | "ONLINE_PREFLIGHT" | "NORMALIZATION" | "ONLINE_RESEARCH" | "RUNTIME_VERIFICATION";

export interface MediaCounters {
  scenesTotal: number;
  scenesProcessed: number;
  framesTotal: number;
  framesProcessed: number;
  boundariesTotal: number;
  boundariesProcessed: number;
  observations: number;
  patterns: number;
}

export type CapabilityState = "IMPLEMENTED" | "AVAILABLE" | "CONFIGURED" | "EXECUTABLE" | "UNAVAILABLE" | "NOT_IMPLEMENTED";

export interface CapabilityAvailability {
  capability: string;
  label: string;
  implemented: boolean;
  configured: boolean;
  executable: boolean;
  state: CapabilityState;
  /** Exact reason (Admin-only diagnostics; never contains credentials). */
  reason: string;
  route: string;
}

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
  /** Phase 18C — measured media work for the current source (only what was actually counted). */
  media?: MediaCounters;
  /** Phase 18C — capabilities reported unavailable during this session. */
  unavailableCapabilities?: string[];
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
    perSource: Array<{
      sourceId: string; title: string; status: "PROCESSED" | "FAILED"; notes: string[]; unavailable: string[]; summary: Record<string, unknown>;
      /** Phase 18C — truthful learning outcome for the source. */
      learningStatus?: "KNOWLEDGE_EXTRACTED" | "PROCESSED" | "PARTIALLY_ANALYZED" | "REQUIRES_REVIEW" | "UNAVAILABLE_CAPABILITY" | "FAILED";
      /** Phase 18C — processing artifact file holding structured observations (Admin view). */
      artifact?: { kind: "VIDEO_OBSERVATIONS"; observations: number; patterns: number } | null;
    }>;
    /** Phase 18C — capability availability snapshot at session start (Admin-only diagnostics). */
    capabilities?: CapabilityAvailability[];
    /** Phase 20 — online pre-flight and task-aware research (absent for sessions created earlier). */
    online?: SessionOnlineResearch;
  };
  /** Phase 20 — AUTO adds task-selected approved online sources after the uploaded material is analysed. */
  research?: "AUTO" | "OFF";
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

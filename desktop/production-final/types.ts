/** Phase 5 Step 4 — Final Assembly, Render, Quality Control & Export Engine */

import type { PipelineArtifact, PipelineError, PipelineState } from "../production-pipeline/types";
import type { LiveProductionState } from "../production-command-center/types";
import type { ClaimAuditItem, OutputConfig, ScenePlan } from "../production-plan/types";

export type FinalizationStatus =
  | "IDLE"
  | "BLOCKED"
  | "ASSEMBLING"
  | "RENDERING"
  | "VALIDATING"
  | "QC_FAILED"
  | "EXPORTING"
  | "COMPLETED"
  | "FAILED";

export type FinalizationStage =
  | "INPUT_VALIDATION"
  | "SCENE_VALIDATION"
  | "SCENE_ASSEMBLY"
  | "MASTER_TIMELINE"
  | "AV_SYNC"
  | "AUDIO_MIX"
  | "TEXT_COMPOSITION"
  | "VISUAL_COMPOSITION"
  | "FINAL_RENDER"
  | "RENDER_VALIDATION"
  | "QUALITY_CONTROL"
  | "THUMBNAIL"
  | "OUTPUT_PACKAGING"
  | "EXPORT"
  | "COMPLETE";

export type FinalizationErrorClass =
  | "ASSEMBLY_ERROR"
  | "RENDER_ERROR"
  | "AUDIO_ERROR"
  | "VIDEO_ERROR"
  | "TEXT_ERROR"
  | "ASSET_ERROR"
  | "QC_ERROR"
  | "EXPORT_ERROR"
  | "STORAGE_ERROR"
  | "CONFIGURATION_ERROR"
  | "SYSTEM_ERROR";

export type QcCheckStatus = "PASS" | "FAIL" | "CHECK_NOT_AVAILABLE" | "WARNING";

export interface ValidationItem {
  id: string;
  label: string;
  ok: boolean;
  critical: boolean;
  detail: string;
}

export interface SceneValidationResult {
  sceneId: string;
  sceneName: string;
  order: number;
  ok: boolean;
  checks: ValidationItem[];
}

export interface TimelineClip {
  sceneId: string;
  sceneName: string;
  order: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  visualRef: string | null;
  voiceRef: string | null;
  musicRef: string | null;
  sfxRef: string | null;
  textRef: string | null;
  subtitleRef: string | null;
  transition: string;
}

export interface MasterTimeline {
  timelineId: string;
  productionId: string;
  version: string;
  totalDurationSec: number;
  clips: TimelineClip[];
  tracks: {
    visual: string[];
    voice: string[];
    music: string[];
    sfx: string[];
    text: string[];
    subtitle: string[];
    transition: string[];
  };
  gaps: number;
  overlaps: number;
  valid: boolean;
  notes: string[];
}

export interface SyncCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface AudioMixArtifact {
  mixId: string;
  outputPath: string;
  version: string;
  voiceLevel: number;
  musicLevel: number;
  sfxLevel: number;
  duckingApplied: boolean;
  fadeInSec: number;
  fadeOutSec: number;
  durationSec: number;
  sourceRefs: string[];
  validationState: "VALID" | "WARNING" | "INVALID";
}

export interface TextComposition {
  compositionId: string;
  lines: Array<{ id: string; text: string; sceneId: string; startSec: number; endSec: number; kind: string }>;
  subtitlePath: string;
  language: string;
  claimsSafe: boolean;
  notes: string[];
}

export interface RenderProgress {
  percent: number;
  frame: number;
  totalFrames: number;
  speedFps: number | null;
  etaSec: number | null;
  checkpointFrame: number | null;
}

export interface RenderResult {
  renderId: string;
  outputPath: string;
  version: string;
  durationSec: number;
  resolution: string;
  aspectRatio: string;
  frameRate: string;
  codec: string;
  container: string;
  fileSizeBytes: number;
  hasAudio: boolean;
  hasVideo: boolean;
  checksum: string;
  validationState: "VALID" | "INVALID";
  validationNotes: string[];
  engine: string;
}

export interface QcCheck {
  id: string;
  label: string;
  status: QcCheckStatus;
  detail: string;
}

export interface QualityControlReport {
  reportId: string;
  productionId: string;
  projectName: string;
  createdAt: string;
  overall: "PASS" | "FAILED";
  checks: QcCheck[];
  claimAudit: ClaimAuditItem[];
  blockingReasons: string[];
}

export interface ThumbnailResult {
  thumbnailId: string;
  outputPath: string;
  version: string;
  width: number;
  height: number;
  productVisible: boolean;
  validationState: "VALID" | "WARNING" | "INVALID";
  notes: string[];
  checksum: string;
}

export interface FinalOutputItem {
  outputId: string;
  productionId: string;
  projectId: string;
  kind: "Video" | "Audio" | "Subtitle" | "Thumbnail" | "Report" | "Metadata";
  version: string;
  path: string;
  format: string;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
  validationStatus: "VALID" | "WARNING" | "INVALID";
}

export interface FinalOutputPackage {
  packageId: string;
  productionId: string;
  projectId: string;
  projectName: string;
  runId: string;
  versionLabel: string;
  versionNumber: number;
  createdAt: string;
  outputs: FinalOutputItem[];
  videoId: string | null;
  thumbnailId: string | null;
  audioId: string | null;
  subtitleId: string | null;
  reportId: string | null;
  qcReportId: string | null;
  outputDirectory: string;
}

export interface FinalizationError {
  errorId: string;
  stage: FinalizationStage;
  errorClass: FinalizationErrorClass;
  message: string;
  detail: string;
  timestamp: string;
  recoveryRecommendation: string;
}

export interface FinalizationCheckpoint {
  checkpointId: string;
  stage: FinalizationStage;
  frame: number | null;
  timestamp: string;
  note: string;
}

export interface ProductionHistoryEntry {
  historyId: string;
  productionId: string;
  projectId: string;
  projectName: string;
  runId: string;
  versionLabel: string;
  startedAt: string;
  completedAt: string;
  totalDurationSec: number;
  finalVideoPath: string | null;
  thumbnailPath: string | null;
  qcResult: "PASS" | "FAILED";
  warnings: string[];
  errors: string[];
  resourceSummary: string;
  packageId: string;
}

export interface FinalizationState {
  version: 1;
  status: FinalizationStatus;
  stage: FinalizationStage;
  progress: number;
  productionId: string;
  runId: string;
  projectId: string;
  projectName: string;
  live: LiveProductionState;
  pipelineState: PipelineState;
  inputValidation: ValidationItem[];
  sceneValidations: SceneValidationResult[];
  timeline: MasterTimeline | null;
  syncChecks: SyncCheck[];
  audioMix: AudioMixArtifact | null;
  textComposition: TextComposition | null;
  outputConfig: OutputConfig | null;
  render: RenderResult | null;
  renderProgress: RenderProgress;
  qcReport: QualityControlReport | null;
  thumbnail: ThumbnailResult | null;
  package: FinalOutputPackage | null;
  errors: FinalizationError[];
  warnings: string[];
  checkpoints: FinalizationCheckpoint[];
  historyEntry: ProductionHistoryEntry | null;
  phase5Complete: boolean;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  recommendation: string;
}

export interface FinalizationUiSnapshot {
  version: 1;
  state: FinalizationState | null;
  recommendation: string;
  ticking: boolean;
  updatedAt: string;
}

export const FINAL_STORE_KEY = "kwizera.production-final.v1";
export const FINAL_HISTORY_KEY = "kwizera.production-final.history.v1";
export const FINAL_HANDOFF_KEY = "kwizera.production-final.complete.v1";
export const PHASE5_COMPLETE_KEY = "kwizera.phase-5.complete.v1";

export const STAGE_ORDER: FinalizationStage[] = [
  "INPUT_VALIDATION",
  "SCENE_VALIDATION",
  "SCENE_ASSEMBLY",
  "MASTER_TIMELINE",
  "AV_SYNC",
  "AUDIO_MIX",
  "TEXT_COMPOSITION",
  "VISUAL_COMPOSITION",
  "FINAL_RENDER",
  "RENDER_VALIDATION",
  "QUALITY_CONTROL",
  "THUMBNAIL",
  "OUTPUT_PACKAGING",
  "EXPORT",
  "COMPLETE",
];

export const STAGE_WEIGHTS: Record<FinalizationStage, number> = {
  INPUT_VALIDATION: 4,
  SCENE_VALIDATION: 6,
  SCENE_ASSEMBLY: 8,
  MASTER_TIMELINE: 8,
  AV_SYNC: 6,
  AUDIO_MIX: 8,
  TEXT_COMPOSITION: 6,
  VISUAL_COMPOSITION: 8,
  FINAL_RENDER: 20,
  RENDER_VALIDATION: 6,
  QUALITY_CONTROL: 8,
  THUMBNAIL: 4,
  OUTPUT_PACKAGING: 4,
  EXPORT: 4,
  COMPLETE: 0,
};

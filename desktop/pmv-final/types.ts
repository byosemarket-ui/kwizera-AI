/**
 * Product Marketing Video Step 4 — Audio + Timeline + Final Render.
 * Reuses Audio Library, Beat Sync, VideoProductionManager standard path (no second renderer).
 */

import {
  PRODUCTION_STAGES,
  resolveStageByProgress,
  type ProductionStageItem,
} from "../final-review/final-review-engine";

export type PmvBeatSyncMode = "OFF" | "SMART" | "STRICT";

export type PmvProduceStatus =
  | "NOT_STARTED"
  | "AUDIO_READY"
  | "TIMELINE_READY"
  | "RENDERING"
  | "VALIDATING"
  | "FINAL_READY"
  | "QA_IN_PROGRESS"
  | "QA_PASSED"
  | "QA_FAILED"
  | "NEEDS_REVIEW"
  | "REGENERATING"
  | "DELIVERED"
  | "FAILED"
  | "STALE";

export type PmvAudioUiStatus =
  | "NOT_SELECTED"
  | "READY"
  | "ANALYZING"
  | "UNAVAILABLE";

export type PmvTimelineUiStatus =
  | "NOT_READY"
  | "READY"
  | "NEEDS_UPDATE";

export type PmvFinalVideoUiStatus =
  | "NOT_READY"
  | "READY"
  | "STALE"
  | "FAILED";

export interface PmvAudioLibraryItem {
  assetId: string;
  title: string;
  durationMs: number;
  playbackUrl: string;
  status: string;
  bpm: number | null;
  bpmConfidence: number | null;
  analysisStatus: string | null;
}

export interface PmvAudioIntelligenceView {
  status: string;
  bpm: number | null;
  bpmConfidence: number | null;
  beatCount: number;
  energyLabel: string | null;
  message: string | null;
}

export interface PmvMusicCapabilityView {
  available: boolean;
  status: string;
  reason: string | null;
}

export interface PmvProduceState {
  status: PmvProduceStatus;
  audioStatus: PmvAudioUiStatus;
  timelineStatus: PmvTimelineUiStatus;
  finalVideoStatus: PmvFinalVideoUiStatus;
  selectedAudioAssetId: string | null;
  selectedAudioTitle: string | null;
  audioEnabled: boolean;
  audioVolume: number;
  beatSyncMode: PmvBeatSyncMode;
  library: PmvAudioLibraryItem[];
  intelligence: PmvAudioIntelligenceView | null;
  musicCapability: PmvMusicCapabilityView;
  timelineReady: boolean;
  sceneCount: number;
  finalRenderJobId: string | null;
  finalOutputUrl: string | null;
  finalOutputAssetId: string | null;
  finalDurationMs: number | null;
  finalWidth: number | null;
  finalHeight: number | null;
  progress: number;
  stageLabel: string;
  errorMessage: string | null;
  voiceNote: string;
}

export function mapLibraryItem(raw: Record<string, unknown>): PmvAudioLibraryItem {
  const meta = (raw.metadata && typeof raw.metadata === "object")
    ? raw.metadata as Record<string, unknown>
    : {};
  return {
    assetId: String(raw.assetId ?? ""),
    title: String(raw.title ?? raw.originalFilename ?? "Audio"),
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : 0,
    playbackUrl: String(raw.playbackUrl ?? ""),
    status: String(raw.status ?? "READY"),
    bpm: typeof meta.bpm === "number" ? meta.bpm : null,
    bpmConfidence: typeof meta.bpmConfidence === "number" ? meta.bpmConfidence : null,
    analysisStatus: typeof meta.analysisStatus === "string" ? meta.analysisStatus : null,
  };
}

export function energyLabel(mean: number | null | undefined): string | null {
  if (mean == null || !Number.isFinite(mean)) return null;
  if (mean < 0.25) return "Low";
  if (mean < 0.55) return "Medium";
  return "High";
}

export function mapIntelligence(
  intel: Record<string, unknown> | null | undefined,
): PmvAudioIntelligenceView | null {
  if (!intel) return null;
  const tempo = (intel.tempo && typeof intel.tempo === "object")
    ? intel.tempo as Record<string, unknown>
    : {};
  const bpm = typeof intel.bpm === "number"
    ? intel.bpm
    : (typeof tempo.bpm === "number" ? tempo.bpm : null);
  const bpmConfidence = typeof intel.bpmConfidence === "number"
    ? intel.bpmConfidence
    : (typeof tempo.confidence === "number" ? tempo.confidence : null);
  const beats = Array.isArray(intel.beats) ? intel.beats : [];
  const meanEnergy = typeof intel.meanEnergy === "number" ? intel.meanEnergy : null;
  return {
    status: String(intel.status ?? "PENDING"),
    bpm,
    bpmConfidence,
    beatCount: beats.length,
    energyLabel: energyLabel(meanEnergy),
    message: typeof intel.message === "string" ? intel.message : null,
  };
}

export function produceStageLabel(progress: number, status: PmvProduceStatus): string {
  if (status === "FINAL_READY") return "Final video ready";
  if (status === "QA_IN_PROGRESS") return "Checking product quality";
  if (status === "QA_PASSED") return "Quality checks passed";
  if (status === "QA_FAILED") return "Quality checks failed";
  if (status === "NEEDS_REVIEW") return "Needs review";
  if (status === "REGENERATING") return "Fixing one scene";
  if (status === "DELIVERED") return "Final video delivered";
  if (status === "FAILED") return "Final render failed";
  if (status === "STALE") return "Final video stale";
  if (status === "NOT_STARTED") return "Audio & final render";
  const stage: ProductionStageItem = resolveStageByProgress(progress);
  return stage.label;
}

export { PRODUCTION_STAGES, resolveStageByProgress };
export type { ProductionStageItem };

/** Phase 6 Step 1 — AI Creative Review & Preview Center (review layer only). */

import type {
  FinalOutputPackage,
  FinalizationState,
  MasterTimeline,
  ProductionHistoryEntry,
  QualityControlReport,
  QcCheck,
} from "../production-final/types";
import type { PipelineArtifact } from "../production-pipeline/types";

export type CreativeReviewStatus =
  | "NOT_REVIEWED"
  | "READY_FOR_REVIEW"
  | "IN_REVIEW"
  | "NEEDS_CHANGES"
  | "APPROVED"
  | "REJECTED";

export type FeedbackCategory =
  | "PRODUCT_VISIBILITY"
  | "TEXT_READABILITY"
  | "AUDIO"
  | "TIMING"
  | "CTA"
  | "VISUAL"
  | "OTHER";

export type AiReviewAvailability = "AVAILABLE" | "NOT_AVAILABLE";

export interface VideoPreviewMeta {
  available: boolean;
  unavailableReason: string | null;
  path: string | null;
  resolution: string | null;
  frameRate: string | null;
  durationSec: number | null;
  format: string | null;
  fileSizeBytes: number | null;
  version: string | null;
  checksum: string | null;
}

export interface SceneReviewCard {
  sceneId: string;
  sceneNumber: number;
  name: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  hasVisual: boolean;
  hasVoice: boolean;
  hasText: boolean;
  visualRef: string | null;
  voiceRef: string | null;
  textRef: string | null;
  narration: string;
  onScreenText: string;
  transition: string;
  productFocus: string;
  status: string;
}

export interface ImageAssetCard {
  assetId: string;
  label: string;
  type: string;
  path: string;
  resolution: string | null;
  source: string;
  sceneUsage: string | null;
  validationStatus: string;
}

export interface AudioTrackCard {
  id: string;
  name: string;
  kind: "Voice" | "Music" | "SFX" | "Final Mix";
  path: string;
  durationSec: number | null;
  status: string;
}

export interface TextReviewLine {
  id: string;
  sceneId: string;
  kind: string;
  text: string;
  startSec: number;
  endSec: number;
  highlight: "narration" | "cta" | "product" | "promo" | "other";
}

export interface CreativeScoreView {
  available: boolean;
  overall: number | null;
  visual: number | null;
  audio: number | null;
  text: number | null;
  product: number | null;
  label: string;
}

export interface AttentionItem {
  id: string;
  severity: "warning" | "error" | "ok";
  message: string;
  sceneId: string | null;
}

export interface TimestampComment {
  commentId: string;
  productionId: string;
  versionLabel: string;
  runId: string;
  timestampSec: number;
  sceneId: string | null;
  comment: string;
  user: string;
  createdAt: string;
}

export interface ReviewFeedback {
  feedbackId: string;
  productionId: string;
  versionLabel: string;
  runId: string;
  sceneId: string | null;
  category: FeedbackCategory;
  timestampSec: number | null;
  comment: string;
  createdAt: string;
}

export interface ReviewNote {
  noteId: string;
  productionId: string;
  versionLabel: string;
  runId: string;
  sceneId: string | null;
  timestampSec: number | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface VersionHistoryItem {
  versionLabel: string;
  packageId: string;
  productionId: string;
  status: string;
  qcResult: string;
  completedAt: string;
  finalVideoPath: string | null;
}

export interface AiReviewPanel {
  availability: AiReviewAvailability;
  looksGood: string[];
  issues: string[];
  suggestions: string[];
  warnings: string[];
  attention: string[];
  note: string;
}

/** Data contract for Phase 6 Step 2 AI Me assistant — Step 1 only exposes state. */
export interface CreativeReviewAiMeContract {
  version: 1;
  step: "phase-6-step-2-ai-assistant";
  projectId: string;
  projectName: string;
  productionId: string;
  runId: string;
  versionLabel: string;
  reviewStatus: CreativeReviewStatus;
  qcOverall: string | null;
  creativeScore: CreativeScoreView;
  attentionItems: AttentionItem[];
  feedback: ReviewFeedback[];
  timestampComments: TimestampComment[];
  notes: ReviewNote[];
  selectedSceneId: string | null;
  videoAvailable: boolean;
  packageId: string | null;
  explanation: string;
}

export interface CreativeReviewState {
  version: 1;
  projectId: string;
  projectName: string;
  productionId: string;
  runId: string;
  versionLabel: string;
  packageId: string;
  productionStatus: string;
  reviewStatus: CreativeReviewStatus;
  package: FinalOutputPackage | null;
  qc: QualityControlReport | null;
  timeline: MasterTimeline | null;
  video: VideoPreviewMeta;
  scenes: SceneReviewCard[];
  images: ImageAssetCard[];
  audioTracks: AudioTrackCard[];
  textLines: TextReviewLine[];
  creativeScore: CreativeScoreView;
  attention: AttentionItem[];
  aiReview: AiReviewPanel;
  qcChecks: QcCheck[];
  feedback: ReviewFeedback[];
  notes: ReviewNote[];
  timestampComments: TimestampComment[];
  versionHistory: VersionHistoryItem[];
  selectedSceneId: string | null;
  comparisonBefore: ImageAssetCard | null;
  comparisonAfter: ImageAssetCard | null;
  mediaError: string | null;
  createdAt: string;
  updatedAt: string;
  recommendation: string;
}

export interface CreativeReviewUiSnapshot {
  version: 1;
  state: CreativeReviewState | null;
  recommendation: string;
  updatedAt: string;
}

export const REVIEW_STORE_KEY = "kwizera.creative-review.v1";
export const REVIEW_HANDOFF_KEY = "kwizera.creative-review.handoff.v1";

export type ReviewPersistedBlob = {
  byVersion: Record<string, {
    reviewStatus: CreativeReviewStatus;
    feedback: ReviewFeedback[];
    notes: ReviewNote[];
    timestampComments: TimestampComment[];
    selectedSceneId: string | null;
    aiReview?: AiReviewPanel;
    updatedAt: string;
  }>;
};

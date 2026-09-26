/** Unified STEP 1 — Product Setup types */

import type { IntakeAssetMeta, IntakeSnapshot } from "../product-intake/types";
import type { OrganizationSnapshot, OrganizedImage, ProductImageSet } from "../image-organization/types";
import type {
  PmvIntelligenceStatus,
  ProductIdentityLock,
  ProductIntelligenceReview,
} from "../product-identity-lock/types";
import type {
  PmvAudioRequirements,
  PmvCreativeDirection,
  PmvCreativeStatus,
  PmvModeCapabilityView,
  PmvStoryboardSceneView,
} from "../pmv-creative/types";
import type {
  PmvAudioIntelligenceView,
  PmvAudioLibraryItem,
  PmvAudioTask,
  PmvBeatSyncMode,
  PmvMusicCapabilityView,
  PmvProduceStatus,
} from "../pmv-final/types";
import type {
  PmvDeliveryStatus,
  PmvTargetedRegeneration,
  PmvVideoQaResult,
} from "../pmv-qa/types";
import type { PmvFormat, PmvPlatform } from "../../ai/pmv-shared/destination.js";

export type AnalysisUiStatus =
  | "NOT_STARTED"
  | "UPLOADING"
  | "ANALYZING"
  | "COMPLETE"
  | "REVIEW_REQUIRED"
  | "PARTIAL"
  | "FAILED";

export type DataOwnership = "USER_CONFIRMED" | "AI_DETECTED" | "SYSTEM_CALCULATED";

export interface ProductEssentials {
  productName: string;
  currentPrice: number | null;
  previousPrice: number | null;
  currency: string;
  size: string;
  shortDescription: string;
}

export interface OptionalProductDetails {
  brand: string;
  color: string;
  material: string;
  features: string;
  website: string;
  notes: string;
  /** Extended product information for Product Marketing Video foundation */
  longDescription: string;
  benefits: string;
  offer: string;
  productCategory: string;
  productCta: string;
}

/** Customer-facing brand/contact for PMV Step 1 — maps to brandInformation + end-card contract. */
export interface PmvBrandContact {
  brandName: string;
  websiteName: string;
  websiteUrl: string;
  phone: string;
  whatsapp: string;
  email: string;
  cta: string;
  language: string;
  logoAssetId: string | null;
  logoUrl: string | null;
  logoFileName: string | null;
}

export type PmvAspectRatio = PmvFormat;

export interface PmvVideoSettings {
  durationSeconds: number;
  /** true when the customer entered minutes/seconds instead of picking a preset. */
  durationCustom: boolean;
  aspectRatio: PmvAspectRatio;
  /** Explicit destination; null on projects saved before the choice existed (derived from the format). */
  platform: PmvPlatform | null;
  language: string;
  cta: string;
}

/** Foundation lifecycle for Steps 2–5. Step 1 only sets DRAFT / READY_FOR_INTELLIGENCE. */
export type PmvFoundationStatus =
  | "DRAFT"
  | "READY_FOR_INTELLIGENCE"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export const PMV_SETTINGS_KEY = "productMarketingVideo";

export interface PmvFoundationSettings {
  foundationStatus: PmvFoundationStatus;
  heroAssetId: string | null;
  assetOrder: string[];
  durationSeconds: number;
  durationCustom?: boolean;
  aspectRatio: PmvAspectRatio;
  platform?: PmvPlatform;
  /** Step 2 — Product Intelligence lifecycle */
  intelligenceStatus?: PmvIntelligenceStatus;
  intelligenceProfileId?: string | null;
  intelligenceAnalysisVersion?: string | null;
  intelligenceAssetFingerprint?: string | null;
  intelligenceError?: string | null;
  intelligenceReview?: ProductIntelligenceReview | null;
  /** Step 3 — creative plan / generation */
  creativeStatus?: PmvCreativeStatus;
  creativeDirection?: PmvCreativeDirection | null;
  creativePlanId?: string | null;
  creativePlanVersion?: number | null;
  creativePlanStatus?: string | null;
  productionMode?: string | null;
  renderJobId?: string | null;
  videoReady?: boolean;
  creativeError?: string | null;
  audioRequirements?: PmvAudioRequirements | null;
  /** Step 4 — audio + final render */
  produceStatus?: PmvProduceStatus;
  finalRenderJobId?: string | null;
  finalVideoReady?: boolean;
  finalOutputAssetId?: string | null;
  finalOutputUrl?: string | null;
  beatSyncMode?: PmvBeatSyncMode;
  audioVolume?: number;
  selectedAudioAssetId?: string | null;
  /** Step 5 — QA + delivery */
  qaResult?: PmvVideoQaResult | null;
  deliveryStatus?: PmvDeliveryStatus;
  deliveredAt?: string | null;
  approvedRenderJobId?: string | null;
  approvedOutputAssetId?: string | null;
  targetedRegeneration?: PmvTargetedRegeneration | null;
  sceneRegenAttempts?: Record<string, number>;
}

export interface DiscountInfo {
  percent: number | null;
  valid: boolean;
  label: string | null;
  ownership: DataOwnership;
}

export interface ReadinessResult {
  ready: boolean;
  blockingIssues: string[];
  warnings: string[];
  recommendations: string[];
  summary: {
    projectName: boolean;
    validImages: number;
    productName: boolean;
    analysisStatus: AnalysisUiStatus;
  };
  statusLabel: "READY TO CONTINUE" | "READY WITH RECOMMENDATIONS" | "NOT READY";
}

export interface AiProductSummary {
  productLabel: string | null;
  category: string | null;
  imageCount: number;
  usefulViews: string[];
  heroAssetId: string | null;
  coverageLabel: "GOOD PRODUCT COVERAGE" | "LIMITED PRODUCT COVERAGE" | "INSUFFICIENT COVERAGE";
  coverageMessage: string;
}

export interface ImageCardModel {
  assetId: string;
  /** Stable list key (survives temp → server id handoff) */
  clientKey: string;
  url: string | undefined;
  remoteUrl: string | undefined;
  fileName: string;
  aiViewType: string;
  finalViewType: string;
  displayLabel: string;
  confidence: number;
  needsReview: boolean;
  userCorrected: boolean;
  severity: "critical" | "warning" | "info" | "ok";
  issueMessage: string | null;
  isDuplicate: boolean;
  /** Live import state — visible before server save completes */
  uploadStatus: "uploading" | "saved" | "failed";
  /** True while still showing a blob: local preview */
  usingLocalPreview: boolean;
}

export type SaveState = "saved" | "saving" | "unsaved" | "error";

export interface MediaPreparationUiSummary {
  total: number;
  ready: number;
  needsReview: number;
  lowQuality: number;
  failed: number;
  processing: number;
  usableCount: number;
  productAnalysisReady: boolean;
  isolationReady: boolean;
  statusLabel: string;
}

export interface ProductSetupSnapshot {
  version: 1;
  projectId: string | null;
  projectName: string;
  intake: IntakeSnapshot;
  organization: OrganizationSnapshot;
  essentials: ProductEssentials;
  optional: OptionalProductDetails;
  discount: DiscountInfo;
  analysisStatus: AnalysisUiStatus;
  aiSummary: AiProductSummary | null;
  imageCards: ImageCardModel[];
  readiness: ReadinessResult;
  saveState: SaveState;
  canContinue: boolean;
  continueBlockedReason: string | null;
  continueLabel: string;
  mediaPreparation: MediaPreparationUiSummary | null;
  updatedAt: string;
  /** Product Marketing Video foundation fields (always present; defaults when unused). */
  brandContact: PmvBrandContact;
  videoSettings: PmvVideoSettings;
  foundationStatus: PmvFoundationStatus;
  heroAssetId: string | null;
  assetOrder: string[];
  canMarkReady: boolean;
  readyBlockedReason: string | null;
  /** Step 2 — Product Intelligence + Identity Lock */
  intelligenceStatus: PmvIntelligenceStatus;
  intelligenceReview: ProductIntelligenceReview | null;
  identityLock: ProductIdentityLock | null;
  intelligenceError: string | null;
  canConfirmIdentityLock: boolean;
  canContinueToCreative: boolean;
  identityLockBlockedReason: string | null;
  /** Step 3 — Creative Plan + Video Generation */
  creativeStatus: PmvCreativeStatus;
  creativeDirection: PmvCreativeDirection;
  creativeScenes: PmvStoryboardSceneView[];
  creativeCapabilities: PmvModeCapabilityView[];
  /** Backend-decided video-mode availability (customer-safe); null while loading. */
  videoModes: import("../../ai/pmv-shared/video-mode-resolver").PmvModeAvailability[] | null;
  creativePlanId: string | null;
  creativePlanStatus: string | null;
  creativeError: string | null;
  videoReady: boolean;
  renderJobId: string | null;
  audioRequirements: PmvAudioRequirements | null;
  canGenerateCreativePlan: boolean;
  canGenerateVideo: boolean;
  creativeBlockedReason: string | null;
  /** Step 4 — Audio + Timeline + Final Render */
  produceStatus: PmvProduceStatus;
  audioLibrary: PmvAudioLibraryItem[];
  selectedAudioAssetId: string | null;
  selectedAudioTitle: string | null;
  audioEnabled: boolean;
  audioVolume: number;
  beatSyncMode: PmvBeatSyncMode;
  audioIntelligence: PmvAudioIntelligenceView | null;
  musicCapability: PmvMusicCapabilityView;
  /** A voice-over is on for this project (music is mixed under it). */
  voiceSelected: boolean;
  audioTask: PmvAudioTask | null;
  /** Music added by the customer this session (always listed). */
  addedAudioAssetIds: string[];
  timelineReady: boolean;
  finalRenderJobId: string | null;
  finalVideoReady: boolean;
  finalOutputUrl: string | null;
  finalOutputAssetId: string | null;
  finalDurationMs: number | null;
  finalWidth: number | null;
  finalHeight: number | null;
  produceProgress: number;
  produceStageLabel: string;
  produceError: string | null;
  canRefreshAudioLibrary: boolean;
  canSelectAudio: boolean;
  canStartFinalRender: boolean;
  produceBlockedReason: string | null;
  /** Step 5 — Product Identity QA + delivery */
  qaResult: PmvVideoQaResult | null;
  deliveryStatus: PmvDeliveryStatus;
  deliveredAt: string | null;
  approvedRenderJobId: string | null;
  approvedOutputAssetId: string | null;
  targetedRegeneration: PmvTargetedRegeneration | null;
  canRunQa: boolean;
  canRegenerateFailedScene: boolean;
  canMarkDelivered: boolean;
  qaBlockedReason: string | null;
}

export interface Step2HandoffPayload {
  version: 1;
  step: "step-2-video-requirements";
  projectId: string;
  projectName: string;
  productImageSet: ProductImageSet;
  essentials: ProductEssentials;
  optional: OptionalProductDetails;
  discount: DiscountInfo;
  category: string | null;
  preparedAt: string;
}

export type { IntakeAssetMeta, OrganizedImage, ProductImageSet };

import type { VideoPlatformId } from "../../ai/video-production/platform-profiles.js";
import type { ProductImageSet } from "../image-organization/types";

export type SaveState = "saved" | "saving" | "unsaved" | "error";

export type CampaignObjectiveOption =
  | "Product Showcase"
  | "Promote Sale"
  | "New Product"
  | "Brand Awareness"
  | "Drive Orders";

export type DurationOption = "15s" | "30s" | "45s" | "60s" | "custom";

export interface CommercialFields {
  productName: string;
  currentPrice: number | null;
  previousPrice: number | null;
  currency: string;
  website: string;
  contact: string;
}

export interface DiscountPreview {
  valid: boolean;
  percent: number | null;
  label: string | null;
}

export interface SellingPointEntry {
  id: string;
  text: string;
  source: "USER_CONFIRMED" | "AI_INFERRED" | "CONFIRMED";
  confidence: number;
  status: "confirmed" | "suggested" | "rejected";
}

export interface ProductSummary {
  productId: string;
  name: string;
  category: string;
  imageCount: number;
  heroAssetId: string | null;
  heroUrl: string | null;
  statusLabel: string;
}

export interface IntelligenceSummary {
  lines: string[];
  viewsDetected: string[];
  viewsMissing: string[];
}

export interface PlatformPreview {
  id: VideoPlatformId;
  label: string;
  orientation: string;
  aspectRatio: string;
  width: number;
  height: number;
  maxDurationSec: number;
}

export interface ReadinessResult {
  ready: boolean;
  blockingIssues: string[];
  warnings: string[];
  statusLabel: string;
}

export interface VideoRequirementsSnapshot {
  version: 1;
  projectId: string | null;
  projectName: string;
  briefId: string | null;
  product: ProductSummary | null;
  commercial: CommercialFields;
  discount: DiscountPreview;
  platformId: VideoPlatformId;
  platformPreview: PlatformPreview;
  duration: DurationOption;
  customDurationSeconds: number | null;
  objective: CampaignObjectiveOption;
  language: string;
  cta: string;
  sellingPoints: SellingPointEntry[];
  intelligence: IntelligenceSummary | null;
  mediaPreparation: {
    statusLabel: string;
    ready: number;
    total: number;
    needsReview: number;
    productAnalysisReady: boolean;
  } | null;
  productImageSet: ProductImageSet | null;
  assetIds: string[];
  saveState: SaveState;
  readiness: ReadinessResult;
  canContinue: boolean;
  continueBlockedReason: string | null;
  updatedAt: string;
}

export interface Step3HandoffPayload {
  version: 1;
  step: "step-3-video-style";
  projectId: string;
  projectName: string;
  briefId: string;
  productId: string;
  assetIds: string[];
  platformId: VideoPlatformId;
  durationSeconds: number;
  objective: CampaignObjectiveOption;
  language: string;
  preparedAt: string;
}

export const STEP3_HANDOFF_KEY = "kwizera.video-requirements.handoff.v1";

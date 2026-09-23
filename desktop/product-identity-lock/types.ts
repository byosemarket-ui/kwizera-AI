/**
 * Product Marketing Video Step 2 — Product Identity Lock contract.
 * Built from Product Intelligence; persisted on the project for Steps 3–5.
 */

export const PRODUCT_IDENTITY_LOCK_VERSION = "pil-v1";
export const PMV_IDENTITY_LOCK_KEY = "productIdentityLock";

/** Customer-visible intelligence lifecycle (independent of video COMPLETED). */
export type PmvIntelligenceStatus =
  | "NOT_STARTED"
  | "ANALYZING"
  | "REVIEW"
  | "LOCKED"
  | "STALE"
  | "FAILED"
  | "UNAVAILABLE";

export type IdentityLockStatus =
  | "PENDING_CONFIRMATION"
  | "LOCKED"
  | "STALE"
  | "INVALID";

/** Attribute with confidence + evidence — never invent high confidence. */
export interface IdentityAttribute {
  value: string;
  confidence: number;
  evidenceAssetId: string | null;
  source: "user-provided" | "observed-from-image" | "inferred" | "unknown";
}

export const PROTECTED_PRODUCT_ATTRIBUTES = [
  "shape",
  "silhouette",
  "color",
  "logo",
  "branding",
  "material",
  "texture",
  "pattern",
  "sole",
  "laces",
  "structure",
  "design",
  "proportions",
  "distinctiveDetails",
] as const;

export type ProtectedProductAttribute = (typeof PROTECTED_PRODUCT_ATTRIBUTES)[number];

export const ALLOWED_CREATIVE_CHANGES = [
  "background",
  "environment",
  "lighting",
  "cameraAngle",
  "cameraMovement",
  "atmosphere",
  "composition",
  "depthOfField",
  "visualEffectsAroundProduct",
  "motion",
  "marketingTypography",
  "marketingPresentation",
] as const;

export type AllowedCreativeChange = (typeof ALLOWED_CREATIVE_CHANGES)[number];

export interface ProductIdentityLock {
  version: typeof PRODUCT_IDENTITY_LOCK_VERSION;
  projectId: string;
  productAssetIds: string[];
  heroAssetId: string;
  identityVersion: string;
  productType: string;
  shape: IdentityAttribute;
  silhouette: IdentityAttribute;
  colors: IdentityAttribute[];
  logo: IdentityAttribute;
  branding: IdentityAttribute;
  material: IdentityAttribute;
  texture: IdentityAttribute;
  pattern: IdentityAttribute;
  sole: IdentityAttribute;
  laces: IdentityAttribute;
  structure: IdentityAttribute;
  design: IdentityAttribute;
  proportions: IdentityAttribute;
  distinctiveDetails: IdentityAttribute[];
  protectedAttributes: ProtectedProductAttribute[];
  allowedCreativeChanges: AllowedCreativeChange[];
  sourceEvidence: Array<{ field: string; assetId: string | null; note: string }>;
  /** Overall lock confidence 0–1 */
  confidence: number;
  /** Capability request — never a provider/model secret */
  analysisCapability: "VISION_ANALYSIS";
  analysisVersion: string;
  profileId: string | null;
  assetFingerprint: string;
  warnings: string[];
  status: IdentityLockStatus;
  createdAt: string;
  updatedAt: string;
  lockedAt: string | null;
}

/** Customer-safe review card — no provider/model/API internals. */
export interface ProductIntelligenceReview {
  profileId: string | null;
  productIdentified: string;
  productType: string;
  category: string;
  brand: string;
  keyColors: string[];
  material: string[];
  textures: string[];
  patterns: string[];
  shapes: string[];
  visibleFeatures: string[];
  logoBranding: string[];
  heroAssetId: string | null;
  imageCount: number;
  qualityNotes: string[];
  warnings: string[];
  confidenceLabel: "high" | "medium" | "low" | "unknown";
  overallConfidence: number;
  analysisVersion: string;
  /** True when vision enrichment was unavailable — deterministic profile only */
  visionUnavailable: boolean;
  visionUnavailableMessage: string | null;
  readyToConfirm: boolean;
  analyzedAt: string | null;
}

export interface PmvIntelligenceState {
  status: PmvIntelligenceStatus;
  review: ProductIntelligenceReview | null;
  lock: ProductIdentityLock | null;
  errorMessage: string | null;
  assetFingerprint: string | null;
}

/**
 * Structured typography decisions for existing video production.
 * Never sent raw to FFmpeg — validated then mapped onto VideoTextLayer.
 */

export const TEXT_ROLES = [
  "title",
  "headline",
  "hook",
  "subtitle",
  "productName",
  "productFeature",
  "benefit",
  "price",
  "previousPrice",
  "discount",
  "promotion",
  "cta",
  "brand",
  "website",
  "phone",
  "sceneCaption",
  "closingMessage",
  "supporting",
] as const;

export type TextRole = (typeof TEXT_ROLES)[number];

/** STEP 3 semantic hierarchy — complements numeric hierarchy rank. */
export const HIERARCHY_LEVELS = [
  "PRIMARY",
  "SECONDARY",
  "SUPPORTING",
  "MINOR",
  "CRITICAL_ACTION",
] as const;

export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number];

export const FONT_WEIGHT_NAMES = [
  "thin",
  "light",
  "regular",
  "medium",
  "semibold",
  "bold",
  "extrabold",
] as const;

export type FontWeightName = (typeof FONT_WEIGHT_NAMES)[number];

export interface EmphasisSpan {
  text: string;
  start: number;
  end: number;
  kind: "full" | "phrase" | "number" | "currency_amount" | "discount" | "cta";
  strength: "strong" | "medium" | "subtle";
}

/** Bounding region for STEP 4 contrast/background work (normalized 0–1). */
export interface TextBoundingArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PLACEMENT_REGIONS = [
  "top-center",
  "top-left",
  "top-right",
  "upper-center",
  "center",
  "center-left",
  "center-right",
  "lower-center",
  "bottom-center",
  "bottom-left",
  "bottom-right",
] as const;

export type PlacementRegion = (typeof PLACEMENT_REGIONS)[number];

export const FONT_PERSONALITIES = [
  "clean-sans",
  "modern-sans",
  "geometric-sans",
  "humanist-sans",
  "serif",
  "editorial-serif",
  "luxury-serif",
  "condensed-display",
  "bold-display",
  "script",
  "handwritten",
  "decorative",
  "monospace",
  "tech",
  "minimal",
  "premium",
  "playful",
  "cinematic",
  "fashion",
  "promotional",
  "neutral",
] as const;

export type FontPersonality = (typeof FONT_PERSONALITIES)[number];

export function isFontPersonality(value: string): value is FontPersonality {
  return (FONT_PERSONALITIES as readonly string[]).includes(value);
}

export type ContrastStrategy = "outline" | "shadow" | "panel" | "none";
export type TextAlignment = "left" | "center" | "right";

export interface VerifiedFont {
  id: string;
  family: string;
  filePath: string;
  style: "regular" | "italic" | "bold" | "bold-italic" | "unknown";
  weight: 400 | 700 | "unknown";
  italic: boolean;
  bold: boolean;
  category: "serif" | "sans" | "script" | "mono" | "display" | "unknown";
  personalities: FontPersonality[];
  roles: TextRole[];
  latinExtended: boolean;
  verified: true;
}

export interface TypographyItem {
  id: string;
  role: TextRole;
  text: string;
  lines: string[];
  font: {
    id: string;
    family: string;
    /** Present on internal plans only — stripped from public diagnostics and API payloads. */
    filePath?: string;
    style: string;
    weight: 400 | 700 | "unknown";
    weightName: FontWeightName;
    personality: FontPersonality;
  };
  layout: {
    region: PlacementRegion;
    normalizedX: number;
    normalizedY: number;
    alignment: TextAlignment;
  };
  size: {
    fontSizePx: number;
    maxLines: number;
    maxWidthPx: number;
  };
  visual: {
    color: string;
    contrastStrategy: ContrastStrategy;
    /** Panel fill when contrastStrategy is panel. */
    panelColor?: "black" | "white";
    /** Measured/estimated WCAG-style contrast ratio after treatment. */
    contrastRatio?: number;
    readabilityPassed?: boolean;
  };
  /** Numeric rank (1 = strongest). Kept for STEP 1/2 compatibility. */
  hierarchy: number;
  hierarchyLevel: HierarchyLevel;
  importanceScore: number;
  emphasis: EmphasisSpan[];
  /** Normalized text box estimate for STEP 4. */
  boundingArea: TextBoundingArea;
  confidence: number;
}

export interface TypographyScenePlan {
  sceneId: string;
  assetId?: string;
  purpose?: string;
  items: TypographyItem[];
  density?: {
    itemCount: number;
    totalWords: number;
    trimmed: boolean;
    warnings: string[];
  };
}

export interface TypographyDecision {
  projectId: string;
  width: number;
  height: number;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
  platform?: string;
  source: "deterministic" | "ai-validated";
  fallbackUsed: boolean;
  scenes: TypographyScenePlan[];
  warnings: string[];
  createdAt: string;
}

export interface TypographyComposeInput {
  projectId: string;
  productCategory?: string;
  productName?: string;
  marketingGoal?: string;
  audience?: string;
  platform?: string;
  language?: string;
  creativeTone?: string;
  productionMode?: string;
  width: number;
  height: number;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
  scenes: Array<{
    sceneId: string;
    purpose?: string;
    assetId?: string;
    texts: Array<{ role: TextRole; text: string }>;
    image?: {
      composition?: string;
      backgroundComplexity?: string;
      backgroundType?: string;
      /** 0–1 or 0–255 — normalized in region analysis. */
      meanLuminance?: number;
      productLikelyCentered?: boolean;
      /** Normalized 0–1 product occupied region from STEP 6/9/10 (frame space when available). */
      productOccupiedRegion?: { x: number; y: number; width: number; height: number };
      /** STEP 10 composition bias sides for placement. */
      preferredTextSides?: Array<"left" | "right" | "top" | "bottom">;
      logoPresent?: boolean;
      /** Local path for STEP 4 region sampling — never persisted publicly. */
      imagePath?: string;
      brandColors?: string[];
      dominantColors?: string[];
    };
  }>;
  brandColors?: string[];
  useOllama?: boolean;
}

export interface PublicTypographyDiagnostics {
  ready: boolean;
  verifiedFontCount: number;
  fallbackFontAvailable: boolean;
  fallbackFamily: string | null;
  discoveryOk: boolean;
  ollamaAssistAvailable: boolean;
  deterministicFallback: true;
  textMeasurementReady: true;
  placementValidationReady: true;
  rendererFontResolutionReady: boolean;
  hierarchyEngineReady: true;
  adaptiveSizingReady: true;
  emphasisEngineReady: true;
  contrastEngineReady: true;
  regionAnalysisReady: true;
  compositionIntegrationReady?: true;
  lastError: string | null;
}

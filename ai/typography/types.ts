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
  "sceneCaption",
  "closingMessage",
  "supporting",
] as const;

export type TextRole = (typeof TEXT_ROLES)[number];

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
  };
  visual: {
    color: string;
    contrastStrategy: ContrastStrategy;
  };
  hierarchy: number;
  confidence: number;
}

export interface TypographyScenePlan {
  sceneId: string;
  assetId?: string;
  items: TypographyItem[];
}

export interface TypographyDecision {
  projectId: string;
  width: number;
  height: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
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
  aspectRatio: "16:9" | "9:16" | "1:1";
  scenes: Array<{
    sceneId: string;
    purpose?: string;
    assetId?: string;
    texts: Array<{ role: TextRole; text: string }>;
    image?: {
      composition?: string;
      backgroundComplexity?: string;
      backgroundType?: string;
      meanLuminance?: number;
      productLikelyCentered?: boolean;
      logoPresent?: boolean;
    };
  }>;
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
  lastError: string | null;
}

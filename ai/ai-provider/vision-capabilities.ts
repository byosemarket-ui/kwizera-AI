/**
 * AI provider capability boundary — Ollama-ready without hard-coding a specific backend.
 * Application logic depends on capabilities, not scattered model-specific code.
 */

export type VisionCapability =
  | "product-reasoning"
  | "scene-planning"
  | "copy-generation"
  | "image-understanding"
  | "structured-json";

export interface VisionAnalysisInput {
  projectId: string;
  assetId: string;
  mimeType: string;
  fileName: string;
  userProductName?: string;
  userCategory?: string;
  /** Optional raw image bytes as base64 (no data-URL prefix) for true vision models. */
  imageBase64?: string;
}

export interface VisionViewGuess {
  view: string;
  confidence: number;
}

/** Optional structured product observations from online/local vision. */
export interface VisionProductObservation {
  field: string;
  value: string;
  confidence: number;
  /** True when the model marked the value unknown/uncertain or confidence is low. */
  uncertain?: boolean;
}

export interface VisionAnalysisResult {
  provider: string;
  model: string | null;
  available: boolean;
  /** Execution source for status reporting (never secrets). */
  source?: "ONLINE" | "LOCAL_FALLBACK" | "DETERMINISTIC" | "UNAVAILABLE" | "CONFIGURATION_ERROR";
  views?: VisionViewGuess[];
  dominantColors?: Array<{ name: string; confidence: number }>;
  backgroundType?: { type: string; confidence: number };
  productCategory?: { category: string; confidence: number };
  /** Extra product-identity observations (shape, material, logo, …). */
  productObservations?: VisionProductObservation[];
  notes: string[];
}

/** Provider contract for future local Ollama vision or other backends. */
export interface VisionProvider {
  readonly id: string;
  readonly capabilities: VisionCapability[];
  isAvailable(): Promise<boolean>;
  analyzeImage(input: VisionAnalysisInput): Promise<VisionAnalysisResult>;
}

/** Default no-op provider — deterministic heuristics remain authoritative until configured. */
export class UnconfiguredVisionProvider implements VisionProvider {
  readonly id = "unconfigured";
  readonly capabilities: VisionCapability[] = [];

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async analyzeImage(_input: VisionAnalysisInput): Promise<VisionAnalysisResult> {
    return {
      provider: this.id,
      model: null,
      available: false,
      notes: ["Vision provider not configured — using deterministic image intelligence."],
    };
  }
}

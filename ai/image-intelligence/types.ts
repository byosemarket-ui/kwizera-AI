export interface ImageBoundaryAnalysis {
  detected: boolean;
  confidence: number;
  notes: string;
}

export interface ImageResolutionAnalysis {
  tier: "low" | "standard" | "high";
  estimatedFromBytes: number;
  notes: string;
}

/** Phase 3 Step 1 — structured visual cues (evidence/heuristic; not pixel-decoded). */
export interface DetectedColorCue {
  name: string;
  role: "primary" | "secondary" | "accent";
  confidence: number;
}

export interface LogoCue {
  present: boolean;
  possibleBrand?: string;
  location?: string;
  confidence: number;
}

export interface DetectedTextCue {
  text: string;
  kind: "brand" | "model" | "label" | "other";
  confidence: number;
}

export interface VisibilityCue {
  percent: number;
  framing: string;
  cutoff: boolean;
  obstruction: string;
  status: "good" | "acceptable" | "needs-review" | "poor";
  confidence: number;
}

export interface ImageIntelligenceProfile {
  id: string;
  projectId: string;
  imageId: string;
  fileName: string;
  mimeType: string;
  quality: { score: number; confidence: number; notes: string[]; classification?: "GOOD" | "ACCEPTABLE" | "NEEDS_REVIEW" | "POOR" };
  background: {
    type: string;
    removable: boolean;
    confidence: number;
    complexity?: "low" | "medium" | "high" | "unknown";
    separation?: string;
    removalSuitability?: "high" | "medium" | "low" | "unknown";
  };
  boundaries: ImageBoundaryAnalysis;
  resolution: ImageResolutionAnalysis;
  viewRole: string;
  duplicateOfImageId?: string;
  lighting: string;
  shadows: string;
  reflections: string;
  cameraAngle: string;
  composition: string;
  perspective: string;
  objects: Array<{ label: string; confidence: number }>;
  scene: string;
  defects: string[];
  enhancements: string[];
  /** Optional Phase 3 visual cues — backward compatible */
  colors?: DetectedColorCue[];
  logo?: LogoCue;
  detectedText?: DetectedTextCue[];
  visibility?: VisibilityCue;
  metadata: Record<string, string | number>;
  /** Knowledge Foundation record ids used during this analysis */
  foundationKnowledgeIds?: string[];
  createdAt: string;
  updatedAt: string;
  cached: boolean;
}

export interface ImageIntelligenceStore {
  profiles: ImageIntelligenceProfile[];
  history: Array<{ id: string; at: string; projectId: string; imageId?: string; event: string; detail: string }>;
  cache: Record<string, string>;
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}

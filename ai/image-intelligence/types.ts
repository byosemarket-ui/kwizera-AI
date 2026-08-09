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

export interface ImageIntelligenceProfile {
  id: string;
  projectId: string;
  imageId: string;
  fileName: string;
  mimeType: string;
  quality: { score: number; confidence: number; notes: string[] };
  background: { type: string; removable: boolean; confidence: number };
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
  metadata: Record<string, string | number>;
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

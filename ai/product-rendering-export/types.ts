export type ExportFormat = "mp4" | "mov" | "webm";

export type RenderResolutionPreset = "1080p" | "2k" | "4k";

export type AspectMode = "portrait" | "landscape" | "square";

export type DeliveryPlatform =
  | "tiktok"
  | "instagram-reels"
  | "instagram-stories"
  | "facebook"
  | "youtube-shorts"
  | "youtube"
  | "whatsapp";

export interface RenderSettings {
  resolutionPreset: RenderResolutionPreset;
  width: number;
  height: number;
  aspect: AspectMode;
  frameRate: number;
  bitrateKbps: number;
  codec: "h264" | "h265" | "vp9" | "offline-package";
  compression: "high" | "balanced" | "small";
  format: ExportFormat;
  platform: DeliveryPlatform;
}

export interface PlatformExport {
  platform: DeliveryPlatform;
  settings: RenderSettings;
  relativeDir: string;
  finalVideoRelativePath: string;
  audioRelativePath: string;
  subtitlesRelativePath: string;
  thumbnailRelativePath: string;
  previewRelativePath: string;
  metadataRelativePath: string;
  encodedContainer?: ExportFormat;
  offlinePackage: true;
  why: string;
}

export interface DeliveryPackageArtifacts {
  finalVideoRelativePath: string;
  thumbnailRelativePath: string;
  previewRelativePath: string;
  audioRelativePath: string;
  subtitlesRelativePath: string;
  exportMetadataRelativePath: string;
  renderReportRelativePath: string;
  projectManifestRelativePath: string;
}

export interface ProductRenderingQuality {
  renderingScore: number;
  exportScore: number;
  platformOptimizationScore: number;
  productAccuracyScore: number;
  logoVisibilityScore: number;
  priceAccuracyScore: number;
  subtitleAccuracyScore: number;
  audioSyncScore: number;
  transitionQualityScore: number;
  exportIntegrityScore: number;
  overall: number;
  issues: string[];
  repairs: string[];
}

export interface ProductRenderingExportResult {
  renderId: string;
  projectId: string;
  productId: string;
  videoGenerationId: string;
  audioGenerationId: string;
  version: number;
  settings: RenderSettings;
  platforms: PlatformExport[];
  artifacts: DeliveryPackageArtifacts;
  composition: {
    includesVideo: true;
    includesVoice: true;
    includesMusic: true;
    includesEffects: true;
    includesSubtitles: true;
    includesLogo: true;
    includesProductName: true;
    includesPrice: boolean;
    includesFeatures: boolean;
    includesPromoText: boolean;
    includesCta: true;
  };
  quality: ProductRenderingQuality;
  improvementRecommendations: string[];
  renderHistoryEntryId: string;
  creativePipelineStep: 9;
  certificationDeferred: true;
  originalsUnmodified: true;
  createdAt: string;
  updatedAt: string;
  cached: boolean;
}

export interface AiMeProductRenderingExportAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainRenderingSettings: boolean;
  canRecommendExportSettings: boolean;
  canDetectRenderingProblems: boolean;
  canCompareExportPresets: boolean;
  canRerenderFromHistory: boolean;
  certificationDeferred: true;
  summary: string;
}

export interface ProductRenderingExportExplainResult {
  renderId: string;
  productName: string;
  summary: string;
  settingsExplanation: string;
  platformComparisons: Array<{ platform: DeliveryPlatform; why: string; width: number; height: number }>;
  problems: string[];
  improvementRecommendations: string[];
  readyForCertification: boolean;
}

export interface ProductRenderingExportHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface ProductRenderingExportStore {
  renders: ProductRenderingExportResult[];
  cache: Record<string, string>;
  history: Array<{
    id: string;
    at: string;
    projectId: string;
    event: string;
    detail: string;
    renderId?: string;
    settings?: RenderSettings;
    qualityScore?: number;
  }>;
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}

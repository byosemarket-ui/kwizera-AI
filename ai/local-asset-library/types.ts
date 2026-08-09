/** Platform Step 2 — Local Asset Library & Asset Intelligence types (single-user, local-only). */

export const LOCAL_ASSET_LIBRARY_VERSION = "1.0";

export type LocalAssetType =
  | "product-image"
  | "product-video"
  | "logo"
  | "brand-kit"
  | "background"
  | "music"
  | "sound-effect"
  | "voice-file"
  | "font"
  | "icon"
  | "template"
  | "intro-video"
  | "outro-video"
  | "animation"
  | "lut"
  | "overlay"
  | "transition"
  | "subtitle"
  | "project-file"
  | "other";

export type AssetVersionKind = "original" | "edited" | "ai-enhanced" | "rendered" | "previous";

export interface AssetMetadata {
  fileType: string;
  extension: string;
  resolution: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  dominantColors: string[];
  language: string | null;
  productCategory: string | null;
  brand: string | null;
  fileSizeBytes: number;
  checksum: string;
}

export interface LocalAssetRecord {
  assetId: string;
  assetName: string;
  assetType: LocalAssetType;
  filePath: string;
  relativePath: string;
  projectId: string | null;
  productName: string | null;
  brand: string | null;
  category: string | null;
  tags: string[];
  manualTags: string[];
  autoTags: string[];
  resolution: string | null;
  fileFormat: string;
  usageCount: number;
  createdAt: string;
  indexedAt: string;
  lastUsedAt: string | null;
  metadata: AssetMetadata;
  versionKind: AssetVersionKind;
  originalAssetId: string | null;
  version: number;
  duplicateOf: string | null;
  relationships: AssetRelationship[];
}

export interface AssetRelationship {
  id: string;
  relatedType: "asset" | "project" | "product" | "knowledge-pack" | "storyboard" | "video" | "template";
  relatedId: string;
  label: string;
}

export interface AssetSearchQuery {
  assetName?: string;
  product?: string;
  category?: string;
  tags?: string[];
  colors?: string[];
  resolution?: string;
  fileType?: string;
  dateFrom?: string;
  dateTo?: string;
  keywords?: string[];
  naturalLanguage?: string;
  assetType?: LocalAssetType;
}

export interface AssetImportInput {
  filePath: string;
  assetName?: string;
  assetType?: LocalAssetType;
  projectId?: string;
  productName?: string;
  brand?: string;
  category?: string;
  manualTags?: string[];
  copyIntoLibrary?: boolean;
}

export interface LocalAssetLibraryResult {
  runId: string;
  version: typeof LOCAL_ASSET_LIBRARY_VERSION;
  processedAt: string;
  indexed: LocalAssetRecord[];
  duplicatesDetected: Array<{ assetId: string; duplicateOf: string }>;
  versionsCreated: LocalAssetRecord[];
  issuesFound: string[];
  issuesRepaired: string[];
  originalsOverwritten: false;
  userAssetsDeleted: false;
  singleUserOnly: true;
  localStorageOnly: true;
  localProductionQueueDeferred: false;
  summary: string;
}

export interface AiMeLocalAssetLibraryAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  singleUserOnly: true;
  canFindAssetsInstantly: boolean;
  canRecommendAssets: boolean;
  canExplainWhySelected: boolean;
  canDetectDuplicates: boolean;
  canRecommendBetterAssets: boolean;
  canNaturalLanguageSearch: boolean;
  localProductionQueueDeferred: false;
  summary: string;
}

export interface LocalAssetLibraryExplainResult {
  assetId?: string;
  whySelected: string;
  duplicates: string[];
  betterAlternatives: string[];
  recommendation: string;
}

export interface LocalAssetLibraryHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface LocalAssetLibraryReportData {
  generatedAt: string;
  existingAssetLibraryCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  assetsIndexed: Array<{ id: string; name: string; type: string }>;
  smartSearchCapability: string;
  autoTaggingCapability: string;
  duplicateDetectionStatus: string;
  versionManagementStatus: string;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep3: string[];
}

export interface LocalAssetLibraryStore {
  assets: LocalAssetRecord[];
  watchFolders: string[];
  runs: LocalAssetLibraryResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}

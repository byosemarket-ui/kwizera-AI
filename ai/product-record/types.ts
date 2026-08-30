import type { CanonicalViewKind } from "./view-kinds.js";

export type AssetLifecycleStatus = "UPLOADED" | "PROCESSING" | "ANALYZED" | "READY" | "FAILED";
export type ProductReadinessState = "NOT_READY" | "PARTIALLY_READY" | "READY" | "FAILED";
export type ViewSource = "ai" | "filename" | "user";

export interface CanonicalAsset {
  assetId: string;
  productId: string;
  originalFilename: string;
  storedFileName: string;
  originalRelativePath: string;
  productionUrl: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  uploadedAt: string;
  processingStatus: AssetLifecycleStatus;
  checksumSha256?: string;
  fileAccessible: boolean;
}

export interface ProductViewEntry {
  assetId: string;
  view: CanonicalViewKind;
  confidence: number;
  source: ViewSource;
  previousView?: CanonicalViewKind;
  correctedAt?: string;
}

export interface ProductIntelligenceOutput {
  productType: string;
  category: string;
  productViews: Partial<Record<CanonicalViewKind, string[]>>;
  visualFeatures: string[];
  confidence: {
    category: number;
    views: number;
  };
}

export interface CanonicalProduct {
  version: 1;
  productId: string;
  projectId: string;
  projectName: string;
  identity: {
    name: string;
    brand: string;
    category: string;
    productType: string;
  };
  originalAssets: CanonicalAsset[];
  processedAssets: CanonicalAsset[];
  productionAssets: CanonicalAsset[];
  finalOutputs: CanonicalAsset[];
  productViews: ProductViewEntry[];
  assetMap: Partial<Record<CanonicalViewKind, string[]>>;
  visualAnalysis: {
    features: string[];
    materials: string[];
    colours: string[];
    analyzedAt: string | null;
  };
  productFeatures: string[];
  marketingData: {
    sellingPoints: string[];
    targetAudience: string;
    keywords: string[];
  };
  productionData: {
    readiness: ProductReadinessState;
    readyReason: string;
    analysisCompleted: boolean;
    requiredAssetsPresent: boolean;
    pathsValid: boolean;
  };
  intelligence: ProductIntelligenceOutput | null;
  updatedAt: string;
}

export const CANONICAL_PRODUCT_VERSION = 1 as const;

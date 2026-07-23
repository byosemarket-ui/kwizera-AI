import { ImageGenerationAssetRegistration, ImageGenerationAssetType, ImageGenerationProjectRegistration, ImageGenerationSource } from "./types.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";
export declare class GenerationAssetRegistry {
    private readonly logger;
    private assets;
    private assetsPath;
    private catalogPath;
    constructor(logger: ImageGenerationFoundationLogger);
    initialize(storage: ImageGenerationStorageManager): void;
    registerAsset(input: Omit<ImageGenerationAssetRegistration, "assetId" | "version" | "createdAt" | "lastUpdated"> & {
        assetId?: string;
    }): ImageGenerationAssetRegistration;
    getAsset(assetId: string): ImageGenerationAssetRegistration | undefined;
    getAssetsByProject(projectId: string): ImageGenerationAssetRegistration[];
    getAssetsByType(assetType: ImageGenerationAssetType): ImageGenerationAssetRegistration[];
    searchAssets(query: {
        projectId?: string;
        assetType?: ImageGenerationAssetType;
        text?: string;
        limit?: number;
    }): ImageGenerationAssetRegistration[];
    getCount(): number;
    getTypeCounts(): Record<string, number>;
    verifyIntegrity(): {
        valid: boolean;
        issues: string[];
    };
    repairSafeIssues(): void;
    private loadFromDisk;
    private persist;
}
export declare function createDefaultGenerationAssetQuality(source?: ImageGenerationSource): Pick<ImageGenerationAssetRegistration, "qualityScore" | "confidenceScore" | "verificationStatus" | "source" | "relationshipLinks" | "relatedProducts" | "relatedBrands" | "relatedCampaigns" | "relatedKnowledge" | "relatedProductionPlans" | "relatedVideos" | "relatedPrompts">;
export declare function createDefaultProjectQuality(): Pick<ImageGenerationProjectRegistration, "qualityScore" | "confidenceScore">;
//# sourceMappingURL=generation-asset-registry.d.ts.map
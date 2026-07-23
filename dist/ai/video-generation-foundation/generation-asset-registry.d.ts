import { GenerationAssetRegistration, GenerationAssetType, GenerationProjectRegistration, VideoGenerationSource } from "./types.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationStorageManager } from "./video-generation-storage.js";
export declare class GenerationAssetRegistry {
    private readonly logger;
    private assets;
    private assetsPath;
    private catalogPath;
    constructor(logger: VideoGenerationFoundationLogger);
    initialize(storage: VideoGenerationStorageManager): void;
    registerAsset(input: Omit<GenerationAssetRegistration, "assetId" | "version" | "createdAt" | "lastUpdated"> & {
        assetId?: string;
    }): GenerationAssetRegistration;
    getAsset(assetId: string): GenerationAssetRegistration | undefined;
    getAssetsByProject(projectId: string): GenerationAssetRegistration[];
    getAssetsByType(assetType: GenerationAssetType): GenerationAssetRegistration[];
    searchAssets(query: {
        projectId?: string;
        assetType?: GenerationAssetType;
        text?: string;
        limit?: number;
    }): GenerationAssetRegistration[];
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
export declare function createDefaultGenerationAssetQuality(source?: VideoGenerationSource): Pick<GenerationAssetRegistration, "qualityScore" | "confidenceScore" | "verificationStatus" | "source" | "relationshipLinks" | "relatedProducts" | "relatedBrands" | "relatedCampaigns" | "relatedKnowledge" | "relatedProductionPlans">;
export declare function createDefaultProjectQuality(): Pick<GenerationProjectRegistration, "qualityScore" | "confidenceScore">;
//# sourceMappingURL=generation-asset-registry.d.ts.map
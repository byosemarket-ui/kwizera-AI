import { AudioGenerationAssetRegistration, AudioGenerationAssetType, AudioGenerationProjectRegistration, AudioGenerationSource } from "./types.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";
export declare class GenerationAssetRegistry {
    private readonly logger;
    private assets;
    private assetsPath;
    private catalogPath;
    constructor(logger: AudioGenerationFoundationLogger);
    initialize(storage: AudioGenerationStorageManager): void;
    registerAsset(input: Omit<AudioGenerationAssetRegistration, "assetId" | "version" | "createdAt" | "lastUpdated"> & {
        assetId?: string;
    }): AudioGenerationAssetRegistration;
    getAsset(assetId: string): AudioGenerationAssetRegistration | undefined;
    getAssetsByProject(projectId: string): AudioGenerationAssetRegistration[];
    getAssetsByType(assetType: AudioGenerationAssetType): AudioGenerationAssetRegistration[];
    searchAssets(query: {
        projectId?: string;
        assetType?: AudioGenerationAssetType;
        text?: string;
        limit?: number;
    }): AudioGenerationAssetRegistration[];
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
export declare function createDefaultGenerationAssetQuality(source?: AudioGenerationSource): Pick<AudioGenerationAssetRegistration, "qualityScore" | "confidenceScore" | "verificationStatus" | "source" | "relationshipLinks" | "relatedProducts" | "relatedBrands" | "relatedCampaigns" | "relatedKnowledge" | "relatedProductionPlans" | "relatedImages" | "relatedVideos" | "relatedPrompts">;
export declare function createDefaultProjectQuality(): Pick<AudioGenerationProjectRegistration, "qualityScore" | "confidenceScore">;
//# sourceMappingURL=audio-generation-asset-registry.d.ts.map
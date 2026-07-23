import { VideoAssetRegistration, VideoAssetType } from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";
export declare class VideoAssetRegistry {
    private readonly logger;
    private assets;
    private assetsPath;
    private catalogPath;
    constructor(logger: VideoIntelligenceFoundationLogger);
    initialize(storage: VideoIntelligenceStorageManager): void;
    registerAsset(input: Omit<VideoAssetRegistration, "assetId" | "version" | "createdAt" | "lastUpdated"> & {
        assetId?: string;
    }): VideoAssetRegistration;
    getAsset(assetId: string): VideoAssetRegistration | undefined;
    getAssetsByProject(projectId: string): VideoAssetRegistration[];
    getAssetsByType(assetType: VideoAssetType): VideoAssetRegistration[];
    getAssetsByVideo(videoId: string): VideoAssetRegistration[];
    searchAssets(query: {
        projectId?: string;
        assetType?: VideoAssetType;
        text?: string;
        limit?: number;
    }): VideoAssetRegistration[];
    getCount(): number;
    getTypeCounts(): Record<string, number>;
    verifyIntegrity(): {
        valid: boolean;
        issues: string[];
    };
    repairSafeIssues(): string[];
    private loadFromDisk;
    private persist;
}
export declare function createDefaultAssetQuality(): VideoAssetRegistration["quality"];
//# sourceMappingURL=video-asset-registry.d.ts.map
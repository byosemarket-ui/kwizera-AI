import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
export type MediaType = "image" | "video" | "audio";
export type ExportFormat = "png" | "jpg" | "webp" | "mp4" | "mov" | "webm" | "mp3" | "wav";
export interface ReviewAsset {
    id: string;
    projectId: string;
    name: string;
    mediaType: MediaType;
    mimeType: string;
    fileName: string;
    createdAt: string;
    version: number;
    approved: boolean;
    quality: QualityReport;
}
export interface QualityReport {
    overallScore: number;
    imageQuality: number;
    videoQuality: number;
    audioQuality: number;
    brandingConsistency: number;
    marketingEffectiveness: number;
    colourConsistency: number;
    composition: number;
    resolution: string;
    recommendations: string[];
}
export interface ReviewProjectState {
    projectId: string;
    assets: ReviewAsset[];
    history: Array<{
        id: string;
        at: string;
        action: string;
        detail: string;
    }>;
    exports: Array<{
        id: string;
        assetId: string;
        format: ExportFormat;
        platform: string;
        resolution: string;
        quality: string;
        status: "complete";
        fileName: string;
        createdAt: string;
    }>;
    regenerationQueue: Array<{
        id: string;
        assetId: string;
        status: "requested";
        createdAt: string;
        instructions?: string;
    }>;
}
export declare class CreativeReviewManager {
    private root;
    private core;
    initialize(storageRoot: string, core?: AiCoreManager): Promise<void>;
    getProjectState(projectId: string): Promise<ReviewProjectState>;
    ingestAsset(projectId: string, input: {
        name: string;
        mimeType: string;
        dataBase64: string;
    }): Promise<ReviewAsset>;
    bootstrapProductImages(project: CreativeProject, images: Array<{
        name: string;
        mimeType: string;
        dataBase64: string;
    }>): Promise<ReviewProjectState>;
    approve(projectId: string, assetId: string): Promise<ReviewAsset>;
    requestRegeneration(projectId: string, assetId: string, instructions?: string): Promise<ReviewProjectState>;
    exportAsset(projectId: string, assetId: string, settings: {
        format: ExportFormat;
        platform: string;
        resolution: string;
        quality: string;
    }): Promise<{
        fileName: string;
        downloadPath: string;
        progress: number;
    }>;
    getAssetPath(projectId: string, fileName: string, exported?: boolean): Promise<string | null>;
    getIntegrationStatus(): Record<string, boolean>;
    private requireAsset;
    private transition;
    private saveState;
    private readJson;
    private ensureReady;
    private projectDirectory;
    private assetDirectory;
    private assetPath;
    private statePath;
}
//# sourceMappingURL=creative-review-manager.d.ts.map
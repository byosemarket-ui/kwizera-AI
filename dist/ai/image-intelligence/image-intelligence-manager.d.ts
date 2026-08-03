import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, CreativeWorkspaceManager, ProductImage } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageIntelligenceProfile, ImageIntelligenceStore } from "./types.js";
/** Persists local image evidence profiles; a vision provider can replace individual analyzers without changing this API. */
export declare class ImageIntelligenceManager {
    private root;
    private core;
    private workspace;
    private store;
    readonly analysis: ImageAnalysisEngine;
    readonly quality: ImageQualityAnalyzer;
    readonly background: BackgroundAnalysisEngine;
    readonly backgroundRemoval: BackgroundRemovalAnalyzer;
    readonly lighting: LightingAnalysisEngine;
    readonly shadow: ShadowAnalysisEngine;
    readonly reflection: ReflectionAnalysisEngine;
    readonly camera: CameraAngleAnalyzer;
    readonly composition: CompositionAnalyzer;
    readonly perspective: PerspectiveAnalyzer;
    readonly objects: ObjectDetectionEngine;
    readonly scene: SceneUnderstandingEngine;
    readonly enhancement: ImageEnhancementDecisionEngine;
    readonly defects: ImageDefectDetectionEngine;
    readonly metadata: ImageMetadataManager;
    readonly history: ImageHistoryManager;
    readonly cache: ImageCacheManager;
    readonly validation: ImageValidationManager;
    readonly analytics: ImageAnalyticsManager;
    initialize(storageRoot: string, dependencies: {
        core: AiCoreManager;
        workspace: CreativeWorkspaceManager;
    }): Promise<void>;
    isInitialized(): boolean;
    analyzeProject(projectId: string): Promise<ImageIntelligenceProfile[]>;
    analyzeImage(project: CreativeProject, image: ProductImage): Promise<ImageIntelligenceProfile>;
    getProfiles(projectId: string): Promise<ImageIntelligenceProfile[]>;
    getDashboard(projectId?: string): Promise<{
        profiles: ImageIntelligenceProfile[];
        history: ImageIntelligenceStore["history"];
        logs: ImageIntelligenceStore["logs"];
        analytics: Record<string, number>;
        integrations: Record<string, boolean>;
    }>;
    persist(): Promise<void>;
    log(level: "info" | "warning" | "error", message: string): void;
    private buildProfile;
    private readStore;
    private ensureReady;
}
export declare class ImageAnalysisEngine {
    finalize(profile: ImageIntelligenceProfile): ImageIntelligenceProfile;
}
export declare class ImageQualityAnalyzer {
    analyze(image: ProductImage): ImageIntelligenceProfile["quality"];
}
export declare class BackgroundAnalysisEngine {
    analyze(evidence: string): ImageIntelligenceProfile["background"];
}
export declare class BackgroundRemovalAnalyzer {
    analyze(background: ImageIntelligenceProfile["background"]): string;
}
export declare class LightingAnalysisEngine {
    analyze(evidence: string): string;
}
export declare class ShadowAnalysisEngine {
    analyze(evidence: string): string;
}
export declare class ReflectionAnalysisEngine {
    analyze(evidence: string): string;
}
export declare class CameraAngleAnalyzer {
    analyze(evidence: string): string;
}
export declare class CompositionAnalyzer {
    analyze(evidence: string): string;
}
export declare class PerspectiveAnalyzer {
    analyze(evidence: string): string;
}
export declare class ObjectDetectionEngine {
    detect(project: CreativeProject, image: ProductImage): ImageIntelligenceProfile["objects"];
}
export declare class SceneUnderstandingEngine {
    understand(project: CreativeProject, objects: ImageIntelligenceProfile["objects"], background: ImageIntelligenceProfile["background"]): string;
}
export declare class ImageEnhancementDecisionEngine {
    recommend(profile: ImageIntelligenceProfile): string[];
}
export declare class ImageDefectDetectionEngine {
    detect(image: ProductImage, quality: ImageIntelligenceProfile["quality"]): string[];
}
export declare class ImageMetadataManager {
    create(image: ProductImage): Record<string, string | number>;
}
export declare class ImageHistoryManager {
    private readonly manager;
    constructor(manager: ImageIntelligenceManager);
    record(projectId: string, imageId: string, event: string, detail: string): void;
}
export declare class ImageCacheManager {
    key(project: CreativeProject, image: ProductImage): string;
}
export declare class ImageValidationManager {
    validate(project: CreativeProject): {
        valid: boolean;
        issues: string[];
    };
}
export declare class ImageAnalyticsManager {
    private readonly manager;
    constructor(manager: ImageIntelligenceManager);
    summary(): Record<string, number>;
}
//# sourceMappingURL=image-intelligence-manager.d.ts.map
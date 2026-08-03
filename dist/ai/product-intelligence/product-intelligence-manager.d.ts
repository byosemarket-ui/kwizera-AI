import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { ProductIntelligenceProfile, ProductIntelligenceStore } from "./types.js";
/** Builds a durable digital product profile from workspace evidence; vision providers can replace these local analyzers later. */
export declare class ProductIntelligenceManager {
    private root;
    private core;
    private workspace;
    private imageIntelligence;
    private store;
    readonly identification: ProductIdentificationEngine;
    readonly classification: ProductClassificationEngine;
    readonly multiView: MultiViewAnalysisEngine;
    readonly reconstruction: ProductReconstructionEngine;
    readonly shape: ProductShapeAnalyzer;
    readonly materials: MaterialDetectionEngine;
    readonly texture: TextureAnalysisEngine;
    readonly colour: ColourIntelligenceEngine;
    readonly features: ProductFeatureExtractor;
    readonly function: ProductFunctionAnalyzer;
    readonly quality: ProductQualityAnalyzer;
    readonly brand: BrandRecognitionEngine;
    readonly relationships: ProductRelationshipEngine;
    readonly decision: ProductDecisionEngine;
    readonly metadata: ProductMetadataManager;
    readonly history: ProductHistoryManager;
    readonly cache: ProductCacheManager;
    readonly validation: ProductValidationManager;
    readonly analytics: ProductAnalyticsManager;
    initialize(storageRoot: string, dependencies: {
        core: AiCoreManager;
        workspace: CreativeWorkspaceManager;
    }): Promise<void>;
    isInitialized(): boolean;
    attachImageIntelligence(manager: ImageIntelligenceManager): void;
    analyze(projectId: string): Promise<ProductIntelligenceProfile>;
    getProfile(projectId: string): Promise<ProductIntelligenceProfile | null>;
    getDashboard(projectId?: string): Promise<{
        profiles: ProductIntelligenceProfile[];
        history: ProductIntelligenceStore["history"];
        logs: ProductIntelligenceStore["logs"];
        analytics: Record<string, number>;
        integrations: Record<string, boolean>;
    }>;
    persist(): Promise<void>;
    log(level: "info" | "warning" | "error", message: string): void;
    private buildProfile;
    private readStore;
    private ensureReady;
}
export declare class ProductIdentificationEngine {
    identify(project: CreativeProject, category: string): string;
}
export declare class ProductClassificationEngine {
    classify(project: CreativeProject): string;
}
export declare class MultiViewAnalysisEngine {
    analyze(project: CreativeProject): {
        viewCount: number;
        coverage: string;
    };
}
export declare class ProductReconstructionEngine {
    reconstruct(profile: ProductIntelligenceProfile): ProductIntelligenceProfile;
}
export declare class ProductShapeAnalyzer {
    analyze(evidence: string, category: string): string[];
}
export declare class MaterialDetectionEngine {
    detect(evidence: string, category: string): string[];
}
export declare class TextureAnalysisEngine {
    analyze(evidence: string, materials: string[]): string[];
}
export declare class ColourIntelligenceEngine {
    detect(evidence: string, names: string[]): string[];
}
export declare class ProductFeatureExtractor {
    extract(project: CreativeProject, materials: string[]): string[];
}
export declare class ProductFunctionAnalyzer {
    analyze(evidence: string, category: string): string[];
}
export declare class ProductQualityAnalyzer {
    analyze(project: CreativeProject, view: {
        viewCount: number;
    }, features: string[]): ProductIntelligenceProfile["quality"];
}
export declare class BrandRecognitionEngine {
    recognize(project: CreativeProject): string;
}
export declare class ProductRelationshipEngine {
    detect(project: CreativeProject, category: string, brand: string): ProductIntelligenceProfile["relationships"];
}
export declare class ProductDecisionEngine {
    recommend(profile: ProductIntelligenceProfile): string;
}
export declare class ProductMetadataManager {
    create(project: CreativeProject, view: {
        viewCount: number;
        coverage: string;
    }): Record<string, string | number>;
}
export declare class ProductHistoryManager {
    private readonly manager;
    constructor(manager: ProductIntelligenceManager);
    record(projectId: string, event: string, detail: string): void;
}
export declare class ProductCacheManager {
    key(project: CreativeProject): string;
}
export declare class ProductValidationManager {
    validate(project: CreativeProject): {
        valid: boolean;
        issues: string[];
    };
}
export declare class ProductAnalyticsManager {
    private readonly manager;
    constructor(manager: ProductIntelligenceManager);
    summary(): Record<string, number>;
}
//# sourceMappingURL=product-intelligence-manager.d.ts.map
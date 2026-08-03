import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativePlanningManager } from "../creative-planning/creative-planning-manager.js";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { AiModelManager } from "../model-management/ai-model-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { MarketingIntelligenceManager } from "../marketing-intelligence/marketing-intelligence-manager.js";
import type { DecisionIntelligenceManager } from "../decision-intelligence/decision-intelligence-manager.js";
import type { AiLearningManager } from "../learning-intelligence/learning-intelligence-manager.js";
import type { GeneratedImage, ImageGenerationRequest, ImageGenerationStore } from "./types.js";
/** Executes safe, local marketing-image composition. A provider can replace the SVG renderer without changing this contract. */
export declare class ImageGenerationManager {
    private root;
    private core;
    private models;
    private workspace;
    private planning;
    private productIntelligence;
    private imageIntelligence;
    private marketingIntelligence;
    private decisionIntelligence;
    private learningIntelligence;
    private store;
    readonly promptExecution: PromptExecutionEngine;
    readonly generator: AiImageGenerator;
    readonly modelSelector: ImageModelSelector;
    readonly modelExecutor: ImageModelExecutor;
    readonly variations: ImageVariationGenerator;
    readonly enhancement: ImageEnhancementEngine;
    readonly background: BackgroundGenerationEngine;
    readonly placement: ProductPlacementEngine;
    readonly composition: CompositionGenerator;
    readonly style: StyleGenerator;
    readonly colour: ColourHarmonyEngine;
    readonly brand: BrandStyleEngine;
    readonly quality: QualityChecker;
    readonly safety: SafetyValidator;
    readonly cache: ImageCacheManager;
    readonly history: GenerationHistoryManager;
    readonly metadata: ImageMetadataManager;
    initialize(storageRoot: string, dependencies: {
        core: AiCoreManager;
        models: AiModelManager;
        workspace: CreativeWorkspaceManager;
        planning: CreativePlanningManager;
    }): Promise<void>;
    isInitialized(): boolean;
    attachProductIntelligence(manager: ProductIntelligenceManager): void;
    attachImageIntelligence(manager: ImageIntelligenceManager): void;
    attachMarketingIntelligence(manager: MarketingIntelligenceManager): void;
    attachDecisionIntelligence(manager: DecisionIntelligenceManager): void;
    attachLearningIntelligence(manager: AiLearningManager): void;
    generate(request: ImageGenerationRequest): Promise<GeneratedImage[]>;
    getDashboard(projectId?: string): Promise<{
        images: GeneratedImage[];
        history: ImageGenerationStore["history"];
        logs: ImageGenerationStore["logs"];
        models: ReturnType<AiModelManager["list"]>;
        integrations: Record<string, boolean>;
        statistics: Record<string, number>;
    }>;
    getAssetPath(imageId: string): Promise<string | null>;
    defaultRequest(projectId: string): Promise<Partial<ImageGenerationRequest>>;
    render(request: ImageGenerationRequest, modelId: string, variation: number): Promise<GeneratedImage>;
    log(level: "info" | "warning" | "error", message: string): void;
    persist(): Promise<void>;
    private readStore;
    private ensureReady;
}
export declare class PromptExecutionEngine {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
    prepare(request: ImageGenerationRequest): Promise<ImageGenerationRequest>;
}
export declare class ImageModelSelector {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
    select(requested?: string): Promise<import("../model-management/types.js").AiModel>;
}
export declare class ImageModelExecutor {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
    load(modelId: string): Promise<void>;
}
export declare class ImageVariationGenerator {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
    create(request: ImageGenerationRequest, modelId: string): Promise<GeneratedImage[]>;
}
export declare class AiImageGenerator {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
    compose(input: {
        request: ImageGenerationRequest;
        variation: number;
        brand: string;
        productName: string;
        productDescription: string;
        sourceImageUrl?: string;
    }): string;
}
export declare class ImageEnhancementEngine {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
}
export declare class BackgroundGenerationEngine {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
}
export declare class ProductPlacementEngine {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
}
export declare class CompositionGenerator {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
}
export declare class StyleGenerator {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
}
export declare class ColourHarmonyEngine {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
}
export declare class BrandStyleEngine {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
}
export declare class QualityChecker {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
    score(request: ImageGenerationRequest, hasProduct: boolean): {
        score: number;
        notes: string[];
    };
}
export declare class SafetyValidator {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
    validate(request: ImageGenerationRequest): void;
}
export declare class ImageCacheManager {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
    key(request: ImageGenerationRequest): string;
}
export declare class GenerationHistoryManager {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
    record(event: string, detail: string, imageIds: string[]): void;
}
export declare class ImageMetadataManager {
    private readonly manager;
    constructor(manager: ImageGenerationManager);
    create(request: ImageGenerationRequest, variation: number): Record<string, string | number>;
}
//# sourceMappingURL=image-generation-manager.d.ts.map
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { MarketingIntelligenceProfile, MarketingIntelligenceStore } from "./types.js";
/** Builds durable campaign strategy profiles from workspace and intelligence evidence without producing creative media. */
export declare class MarketingIntelligenceManager {
    private root;
    private core;
    private workspace;
    private products;
    private images;
    private store;
    readonly analysis: MarketingAnalysisEngine;
    readonly audience: AudienceAnalysisEngine;
    readonly brand: BrandIntelligenceEngine;
    readonly campaign: CampaignIntelligenceEngine;
    readonly sellingPoints: ProductSellingPointAnalyzer;
    readonly value: ValuePropositionEngine;
    readonly cta: CallToActionEngine;
    readonly platform: PlatformOptimizationEngine;
    readonly content: ContentStrategyEngine;
    readonly competitors: CompetitorAnalysisEngine;
    readonly recommendations: MarketingRecommendationEngine;
    readonly decision: MarketingDecisionEngine;
    readonly metadata: MarketingMetadataManager;
    readonly history: MarketingHistoryManager;
    readonly cache: MarketingCacheManager;
    readonly validation: MarketingValidationManager;
    readonly analytics: MarketingAnalyticsManager;
    initialize(storageRoot: string, dependencies: {
        core: AiCoreManager;
        workspace: CreativeWorkspaceManager;
        products: ProductIntelligenceManager;
        images: ImageIntelligenceManager;
    }): Promise<void>;
    isInitialized(): boolean;
    analyze(projectId: string): Promise<MarketingIntelligenceProfile>;
    getProfile(projectId: string): Promise<MarketingIntelligenceProfile | null>;
    getDashboard(projectId?: string): Promise<{
        profiles: MarketingIntelligenceProfile[];
        history: MarketingIntelligenceStore["history"];
        logs: MarketingIntelligenceStore["logs"];
        analytics: Record<string, number>;
        integrations: Record<string, boolean>;
    }>;
    persist(): Promise<void>;
    log(level: "info" | "warning" | "error", message: string): void;
    private buildProfile;
    private readStore;
    private ensureReady;
}
export declare class MarketingAnalysisEngine {
    score(project: CreativeProject, product: {
        quality: {
            score: number;
        };
    }, images: Array<{
        quality: {
            score: number;
        };
    }>, sellingPoints: string[]): number;
}
export declare class AudienceAnalysisEngine {
    analyze(project: CreativeProject): MarketingIntelligenceProfile["audience"];
}
export declare class BrandIntelligenceEngine {
    analyze(project: CreativeProject): MarketingIntelligenceProfile["brand"];
}
export declare class CampaignIntelligenceEngine {
    analyze(project: CreativeProject): MarketingIntelligenceProfile["campaign"];
}
export declare class ProductSellingPointAnalyzer {
    analyze(project: CreativeProject, product: {
        materials: string[];
        features: string[];
        functions: string[];
    }, images: Array<{
        quality: {
            score: number;
        };
    }>): string[];
}
export declare class ValuePropositionEngine {
    create(project: CreativeProject, points: string[], audience: MarketingIntelligenceProfile["audience"]): string;
}
export declare class CallToActionEngine {
    create(project: CreativeProject, campaign: MarketingIntelligenceProfile["campaign"]): string[];
}
export declare class PlatformOptimizationEngine {
    optimize(platform: string): MarketingIntelligenceProfile["platform"];
}
export declare class ContentStrategyEngine {
    create(project: CreativeProject, value: string, platform: MarketingIntelligenceProfile["platform"], cta: string): string;
}
export declare class CompetitorAnalysisEngine {
    analyze(project: CreativeProject, category: string): string[];
}
export declare class MarketingRecommendationEngine {
    create(project: CreativeProject, platform: MarketingIntelligenceProfile["platform"], images: Array<{
        enhancements: string[];
    }>): string[];
}
export declare class MarketingDecisionEngine {
    predict(score: number, platform: MarketingIntelligenceProfile["platform"]): string;
}
export declare class MarketingMetadataManager {
    create(product: {
        id: string;
        quality: {
            score: number;
        };
    }, images: Array<{
        id: string;
    }>): Record<string, string | number>;
}
export declare class MarketingHistoryManager {
    private readonly manager;
    constructor(manager: MarketingIntelligenceManager);
    record(projectId: string, event: string, detail: string): void;
}
export declare class MarketingCacheManager {
    key(project: CreativeProject): string;
}
export declare class MarketingValidationManager {
    validate(project: CreativeProject): {
        valid: boolean;
        issues: string[];
    };
}
export declare class MarketingAnalyticsManager {
    private readonly manager;
    constructor(manager: MarketingIntelligenceManager);
    summary(): Record<string, number>;
}
//# sourceMappingURL=marketing-intelligence-manager.d.ts.map
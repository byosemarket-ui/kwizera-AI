import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeWorkspaceManager, CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { MarketingIntelligenceManager } from "../marketing-intelligence/marketing-intelligence-manager.js";
import type { AiModelManager } from "../model-management/ai-model-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { DecisionIntelligenceProfile, DecisionIntelligenceStore, DecisionOption, DecisionTaskKind } from "./types.js";
/** Persistent project-level reasoning layer. It recommends and records decisions; execution remains owned by existing managers. */
export declare class DecisionIntelligenceManager {
    private root;
    private core;
    private workspace;
    private models;
    private products;
    private images;
    private marketing;
    private store;
    readonly analysis: DecisionAnalysisEngine;
    readonly planning: DecisionPlanningEngine;
    readonly comparison: DecisionComparisonEngine;
    readonly scoring: DecisionScoringEngine;
    readonly strategy: StrategySelectionEngine;
    readonly workflow: WorkflowSelectionEngine;
    readonly model: AiModelSelectionEngine;
    readonly resources: ResourceDecisionEngine;
    readonly risk: RiskEvaluationEngine;
    readonly confidence: ConfidenceScoringEngine;
    readonly validation: DecisionValidationEngine;
    readonly explanation: DecisionExplanationEngine;
    readonly memory: DecisionMemoryManager;
    readonly analytics: DecisionAnalyticsManager;
    readonly history: DecisionHistoryManager;
    readonly cache: DecisionCacheManager;
    initialize(storageRoot: string, dependencies: {
        core: AiCoreManager;
        workspace: CreativeWorkspaceManager;
        models: AiModelManager;
        products: ProductIntelligenceManager;
        images: ImageIntelligenceManager;
        marketing: MarketingIntelligenceManager;
    }): Promise<void>;
    isInitialized(): boolean;
    decide(projectId: string, taskKind?: DecisionTaskKind): Promise<DecisionIntelligenceProfile>;
    getProfile(projectId: string, taskKind?: DecisionTaskKind): Promise<DecisionIntelligenceProfile | null>;
    getDashboard(projectId?: string): Promise<{
        profiles: DecisionIntelligenceProfile[];
        history: DecisionIntelligenceStore["history"];
        logs: DecisionIntelligenceStore["logs"];
        analytics: Record<string, number>;
        integrations: Record<string, boolean>;
    }>;
    persist(): Promise<void>;
    log(level: "info" | "warning" | "error", message: string): void;
    private readStore;
    private ensureReady;
}
export declare class DecisionAnalysisEngine {
    priority(project: CreativeProject, task: DecisionTaskKind): DecisionIntelligenceProfile["priority"];
}
export declare class DecisionPlanningEngine {
    options(project: CreativeProject, task: DecisionTaskKind): DecisionOption[];
}
export declare class DecisionComparisonEngine {
    rank(options: DecisionOption[]): DecisionOption[];
}
export declare class DecisionScoringEngine {
    score(options: DecisionOption[], productScore: number, images: Array<{
        quality: {
            score: number;
        };
    }>, marketingScore: number, resources: DecisionIntelligenceProfile["resourceAnalysis"]): DecisionOption[];
}
export declare class StrategySelectionEngine {
    select(options: DecisionOption[]): DecisionOption;
}
export declare class WorkflowSelectionEngine {
    select(profile: DecisionIntelligenceProfile): string;
}
export declare class AiModelSelectionEngine {
    select(models: AiModelManager, task: DecisionTaskKind): Promise<DecisionIntelligenceProfile["modelRecommendation"]>;
}
export declare class ResourceDecisionEngine {
    analyze(models: AiModelManager): Promise<DecisionIntelligenceProfile["resourceAnalysis"]>;
}
export declare class RiskEvaluationEngine {
    evaluate(project: CreativeProject, images: Array<{
        quality: {
            score: number;
        };
    }>, resources: DecisionIntelligenceProfile["resourceAnalysis"]): string[];
}
export declare class ConfidenceScoringEngine {
    score(product: number, marketing: number, imageCount: number, risk: DecisionOption["risk"]): number;
}
export declare class DecisionValidationEngine {
    validate(project: CreativeProject): {
        valid: boolean;
        issues: string[];
    };
}
export declare class DecisionExplanationEngine {
    create(selected: DecisionOption, model: DecisionIntelligenceProfile["modelRecommendation"], confidence: number, learned: string[]): string;
}
export declare class DecisionMemoryManager {
    private readonly manager;
    constructor(manager: DecisionIntelligenceManager);
    relevant(project: CreativeProject, task: DecisionTaskKind): string[];
}
export declare class DecisionAnalyticsManager {
    private readonly manager;
    constructor(manager: DecisionIntelligenceManager);
    summary(): Record<string, number>;
}
export declare class DecisionHistoryManager {
    private readonly manager;
    constructor(manager: DecisionIntelligenceManager);
    record(projectId: string, event: string, detail: string): void;
}
export declare class DecisionCacheManager {
    key(project: CreativeProject, task: DecisionTaskKind): string;
}
//# sourceMappingURL=decision-intelligence-manager.d.ts.map
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeWorkspaceManager, CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import type { DecisionIntelligenceManager } from "../decision-intelligence/decision-intelligence-manager.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { MarketingIntelligenceManager } from "../marketing-intelligence/marketing-intelligence-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { LearningExperience, LearningProfile, LearningStore } from "./types.js";
/** Captures verified project outcomes and feedback to improve later local recommendations without replacing existing foundation ownership. */
export declare class AiLearningManager {
    private root;
    private core;
    private workspace;
    private products;
    private images;
    private marketing;
    private decisions;
    private store;
    readonly pipeline: LearningPipelineEngine;
    readonly experiences: ExperienceCollectionEngine;
    readonly feedback: FeedbackProcessingEngine;
    readonly performance: PerformanceLearningEngine;
    readonly decision: DecisionLearningEngine;
    readonly creative: CreativeLearningEngine;
    readonly product: ProductLearningEngine;
    readonly workflow: WorkflowLearningEngine;
    readonly knowledge: KnowledgeEvolutionEngine;
    readonly evolution: IntelligenceEvolutionManager;
    readonly recommendations: RecommendationLearningEngine;
    readonly analytics: LearningAnalyticsManager;
    readonly history: LearningHistoryManager;
    readonly validation: LearningValidationEngine;
    readonly optimization: LearningOptimizationEngine;
    initialize(storageRoot: string, dependencies: {
        core: AiCoreManager;
        workspace: CreativeWorkspaceManager;
        products: ProductIntelligenceManager;
        images: ImageIntelligenceManager;
        marketing: MarketingIntelligenceManager;
        decisions: DecisionIntelligenceManager;
    }): Promise<void>;
    isInitialized(): boolean;
    learnFromProject(projectId: string, outcome: LearningExperience["outcome"], detail?: string): Promise<LearningProfile>;
    recordFeedback(projectId: string, feedback: string): Promise<LearningProfile>;
    getDashboard(projectId?: string): Promise<{
        profiles: LearningProfile[];
        experiences: LearningExperience[];
        history: LearningStore["history"];
        logs: LearningStore["logs"];
        analytics: Record<string, number>;
        integrations: Record<string, boolean>;
    }>;
    persist(): Promise<void>;
    log(level: "info" | "warning" | "error", message: string): void;
    private registerFoundations;
    private updateFoundations;
    private key;
    private readStore;
    private ensureReady;
}
export declare class LearningPipelineEngine {
    progress(outcome: LearningExperience["outcome"], product: number, marketing: number): number;
}
export declare class ExperienceCollectionEngine {
    collect(project: CreativeProject, outcome: LearningExperience["outcome"], detail: string | undefined, product: number, images: Array<{
        quality: {
            score: number;
        };
    }>, marketing: number, decision: number): LearningExperience;
}
export declare class FeedbackProcessingEngine {
    preferences(detail?: string): string[];
}
export declare class PerformanceLearningEngine {
    assess(experience: LearningExperience): string;
}
export declare class DecisionLearningEngine {
    learn(profile: {
        selected: {
            label: string;
        };
        confidence: number;
    }): string;
}
export declare class CreativeLearningEngine {
    learn(experience: LearningExperience): string;
}
export declare class ProductLearningEngine {
    learn(project: CreativeProject): string;
}
export declare class WorkflowLearningEngine {
    learn(experience: LearningExperience): string;
}
export declare class KnowledgeEvolutionEngine {
    growth(experience: LearningExperience): number;
}
export declare class IntelligenceEvolutionManager {
    timeline(experience: LearningExperience): string[];
}
export declare class RecommendationLearningEngine {
    create(experience: LearningExperience, decision: {
        selected: {
            label: string;
        };
        confidence: number;
    }, marketing: {
        recommendations: string[];
    }): string[];
}
export declare class LearningAnalyticsManager {
    private readonly manager;
    constructor(manager: AiLearningManager);
    summary(): Record<string, number>;
}
export declare class LearningHistoryManager {
    private readonly manager;
    constructor(manager: AiLearningManager);
    record(projectId: string, event: string, detail: string): void;
}
export declare class LearningValidationEngine {
    validate(project: CreativeProject): {
        valid: boolean;
        issues: string[];
    };
}
export declare class LearningOptimizationEngine {
    improvements(experience: LearningExperience, decision: {
        selected: {
            label: string;
        };
    }): string[];
}
//# sourceMappingURL=learning-intelligence-manager.d.ts.map
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { CreativePlanningManager } from "../creative-planning/creative-planning-manager.js";
import { CreativeReviewManager } from "../creative-review/creative-review-manager.js";
import { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { GenerationOptimizationManager } from "../generation-optimization/generation-optimization-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { MarketingIntelligenceManager } from "../marketing-intelligence/marketing-intelligence-manager.js";
import type { DecisionIntelligenceManager } from "../decision-intelligence/decision-intelligence-manager.js";
import type { AiLearningManager } from "../learning-intelligence/learning-intelligence-manager.js";
import type { ImageGenerationManager } from "../image-generation/image-generation-manager.js";
import type { VideoAudioGenerationManager } from "../video-audio-generation/video-audio-generation-manager.js";
export type PipelineStage = "validation" | "analysis" | "planning" | "prompt-generation" | "generation" | "rendering" | "review" | "export" | "completed" | "failed";
export interface PipelineJob {
    id: string;
    projectId: string;
    stage: PipelineStage;
    progress: number;
    status: "queued" | "running" | "completed" | "failed";
    createdAt: string;
    updatedAt: string;
    startedAt?: string;
    completedAt?: string;
    retryCount: number;
    error?: string;
    notifications: Array<{
        at: string;
        level: "info" | "warning" | "error";
        message: string;
    }>;
    completedStages: PipelineStage[];
}
/** Coordinates the existing creative modules; it does not replace generation or rendering engines. */
export declare class CreativePipelineManager {
    private root;
    private core;
    private workspace;
    private planning;
    private review;
    private optimization;
    private productIntelligenceRuntime;
    private imageIntelligenceRuntime;
    private marketingIntelligenceRuntime;
    private decisionIntelligenceRuntime;
    private learningIntelligenceRuntime;
    private imageGenerationRuntime;
    private videoAudioGenerationRuntime;
    private store;
    private running;
    initialize(storageRoot: string, dependencies: {
        core: AiCoreManager;
        workspace: CreativeWorkspaceManager;
        planning: CreativePlanningManager;
        review: CreativeReviewManager;
    }): Promise<void>;
    enqueue(projectId: string): Promise<PipelineJob>;
    attachGenerationOptimization(manager: GenerationOptimizationManager): void;
    attachProductIntelligence(manager: ProductIntelligenceManager): void;
    attachImageIntelligence(manager: ImageIntelligenceManager): void;
    attachMarketingIntelligence(manager: MarketingIntelligenceManager): void;
    attachDecisionIntelligence(manager: DecisionIntelligenceManager): void;
    attachLearningIntelligence(manager: AiLearningManager): void;
    attachImageGeneration(manager: ImageGenerationManager): void;
    attachVideoAudioGeneration(manager: VideoAudioGenerationManager): void;
    run(jobId: string): Promise<PipelineJob>;
    retry(jobId: string): Promise<PipelineJob>;
    getDashboard(): {
        jobs: PipelineJob[];
        history: PipelineJob[];
        monitor: Record<string, number | string>;
        integrations: Record<string, boolean>;
    };
    private executeStage;
    private note;
    private requireJob;
    private integrations;
    private readStore;
    private save;
    private ensureReady;
}
//# sourceMappingURL=creative-pipeline-manager.d.ts.map
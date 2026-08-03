import type { AiCore } from "../../ai/core/ai-core.js";
import { CreativePlanningManager } from "../../ai/creative-planning/creative-planning-manager.js";
import { CreativePipelineManager } from "../../ai/creative-pipeline/creative-pipeline-manager.js";
import { CreativeReviewManager } from "../../ai/creative-review/creative-review-manager.js";
import { CreativeWorkspaceManager } from "../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageGenerationManager } from "../../ai/image-generation/image-generation-manager.js";
import { AiModelManager } from "../../ai/model-management/ai-model-manager.js";
import { VideoAudioGenerationManager } from "../../ai/video-audio-generation/video-audio-generation-manager.js";
import { GenerationOptimizationManager } from "../../ai/generation-optimization/generation-optimization-manager.js";
import { ProductIntelligenceManager } from "../../ai/product-intelligence/product-intelligence-manager.js";
import { ImageIntelligenceManager } from "../../ai/image-intelligence/image-intelligence-manager.js";
import { MarketingIntelligenceManager } from "../../ai/marketing-intelligence/marketing-intelligence-manager.js";
import { DecisionIntelligenceManager } from "../../ai/decision-intelligence/decision-intelligence-manager.js";
import { AiLearningManager } from "../../ai/learning-intelligence/learning-intelligence-manager.js";
import { DevSessionStore, type DevRuntimeSnapshot } from "./session-store.js";
export interface PersistentRuntimeStatus {
    ready: boolean;
    booting: boolean;
    storageRoot: string;
    sessionId: string;
    restored: boolean;
    message: string;
    runtime: DevRuntimeSnapshot;
    modules: {
        total: number;
        connected: number;
        phases: number;
    };
    bootstrap: {
        created: number;
        existing: number;
    };
}
export declare function getPersistentRuntime(): AiCore | null;
export declare function getWorkspaceManager(): CreativeWorkspaceManager | null;
export declare function getPlanningManager(): CreativePlanningManager | null;
export declare function getReviewManager(): CreativeReviewManager | null;
export declare function getPipelineManager(): CreativePipelineManager | null;
export declare function getModelManager(): AiModelManager | null;
export declare function getImageGenerationManager(): ImageGenerationManager | null;
export declare function getVideoAudioGenerationManager(): VideoAudioGenerationManager | null;
export declare function getGenerationOptimizationManager(): GenerationOptimizationManager | null;
export declare function getProductIntelligenceManager(): ProductIntelligenceManager | null;
export declare function getImageIntelligenceManager(): ImageIntelligenceManager | null;
export declare function getMarketingIntelligenceManager(): MarketingIntelligenceManager | null;
export declare function getDecisionIntelligenceManager(): DecisionIntelligenceManager | null;
export declare function getLearningIntelligenceManager(): AiLearningManager | null;
export declare function getSessionStore(): DevSessionStore | null;
export declare function getRuntimeStatus(): PersistentRuntimeStatus | null;
export declare function isPersistentMode(): boolean;
export declare function bootPersistentRuntime(host: string, port: number): Promise<PersistentRuntimeStatus>;
export declare function saveRuntimeSnapshot(): Promise<void>;
export declare function shutdownPersistentRuntime(): Promise<void>;
export declare function registerShutdownHandlers(): void;
//# sourceMappingURL=runtime.d.ts.map
import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MarketingVideoRecord } from "../marketing-video-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { QualityValidationRecord } from "../video-quality-validation-engine/types.js";
import type { RenderingPreparationRecord } from "../rendering-preparation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import type { VideoProductionRecord } from "../video-production-engine/types.js";
import { ComponentOptimizationPlan, OptimizationDependencyValidationPlan, OptimizationPlanType, OptimizationProfile, PerformanceOptimizationPlan, PipelineOptimizationPlan, QualityOptimizationPlan, RecoveryOptimizationPlan, ResourceOptimizationPlan, SearchOptimizationPlan } from "./types.js";
export interface OptimizationUpstreamAssets {
    scenes: SceneGenerationRecord[];
    cameraPlans: CameraDirectorRecord[];
    motionPlans: MotionGenerationRecord[];
    animationPlans: AnimationGenerationRecord[];
    visualEffectPlans: VisualEffectsGenerationRecord[];
    audioPlans: AudioSynchronizationRecord[];
    marketingPlan: MarketingVideoRecord;
    productionPlan: VideoProductionRecord;
    renderPlan: RenderingPreparationRecord;
    validationReport: QualityValidationRecord;
}
export declare class VideoGenerationOptimizationAnalyzer {
    buildOptimizationRecord(storyboard: StoryboardGenerationRecord, upstream: OptimizationUpstreamAssets, foundation: AiVideoGenerationFoundation, version: number): OptimizationRecordDraft;
    buildProfile(storyboard: StoryboardGenerationRecord, upstream: OptimizationUpstreamAssets, version: number): OptimizationProfile;
    buildComponentOptimization(upstream: OptimizationUpstreamAssets): ComponentOptimizationPlan;
    buildPipelineOptimization(storyboard: StoryboardGenerationRecord, upstream: OptimizationUpstreamAssets): PipelineOptimizationPlan;
    buildResourceOptimization(upstream: OptimizationUpstreamAssets): ResourceOptimizationPlan;
    buildQualityOptimization(storyboard: StoryboardGenerationRecord, upstream: OptimizationUpstreamAssets): QualityOptimizationPlan;
    buildSearchOptimization(storyboard: StoryboardGenerationRecord, upstream: OptimizationUpstreamAssets): SearchOptimizationPlan;
    buildRecoveryOptimization(upstream: OptimizationUpstreamAssets): RecoveryOptimizationPlan;
    buildPerformanceOptimization(upstream: OptimizationUpstreamAssets): PerformanceOptimizationPlan;
    buildDependencyValidation(foundation: AiVideoGenerationFoundation): OptimizationDependencyValidationPlan;
    buildRecommendations(draft: OptimizationRecordDraft): string[];
}
export interface OptimizationRecordDraft {
    optimizationId: string;
    profile: OptimizationProfile;
    planType: OptimizationPlanType;
    componentOptimization: ComponentOptimizationPlan;
    pipelineOptimization: PipelineOptimizationPlan;
    resourceOptimization: ResourceOptimizationPlan;
    qualityOptimization: QualityOptimizationPlan;
    searchOptimization: SearchOptimizationPlan;
    recoveryOptimization: RecoveryOptimizationPlan;
    performanceOptimization: PerformanceOptimizationPlan;
    dependencyValidation: OptimizationDependencyValidationPlan;
}
//# sourceMappingURL=video-generation-optimization-analyzer.d.ts.map
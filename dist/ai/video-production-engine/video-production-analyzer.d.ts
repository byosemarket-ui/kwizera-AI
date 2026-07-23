import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MarketingVideoRecord } from "../marketing-video-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import { AssetValidationPlan, DeliveryInstructionsPlan, DependencyValidationPlan, ExportPreparationPlan, PlatformProductionOptimization, ProductionProfile, ProductionPlanType, ProductionTimelinePlan, ProductionWorkflowPlan, PLATFORM_PRODUCTION_CONFIG, RecoveryPlan, RenderPreparationPlan, WorkflowValidationPlan } from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export interface ProductionUpstreamAssets {
    scenes: SceneGenerationRecord[];
    cameraPlans: CameraDirectorRecord[];
    motionPlans: MotionGenerationRecord[];
    animationPlans: AnimationGenerationRecord[];
    visualEffectPlans: VisualEffectsGenerationRecord[];
    audioPlans: AudioSynchronizationRecord[];
    marketingPlan: MarketingVideoRecord;
}
export declare class VideoProductionAnalyzer {
    buildProductionPlan(storyboard: StoryboardGenerationRecord, upstream: ProductionUpstreamAssets, foundation: AiVideoGenerationFoundation, version: number): VideoProductionRecordDraft;
    buildProfile(storyboard: StoryboardGenerationRecord, marketingPlan: MarketingVideoRecord, version: number): ProductionProfile;
    buildWorkflowValidation(storyboard: StoryboardGenerationRecord, upstream: ProductionUpstreamAssets): WorkflowValidationPlan;
    buildAssetValidation(storyboard: StoryboardGenerationRecord, upstream: ProductionUpstreamAssets): AssetValidationPlan;
    buildDependencyValidation(foundation: AiVideoGenerationFoundation): DependencyValidationPlan;
    buildTimeline(upstream: ProductionUpstreamAssets): ProductionTimelinePlan;
    buildRenderPreparation(platform: StoryboardGenerationPlatform, config: (typeof PLATFORM_PRODUCTION_CONFIG)[StoryboardGenerationPlatform]): RenderPreparationPlan;
    buildExportPreparation(platform: StoryboardGenerationPlatform): ExportPreparationPlan;
    buildDeliveryInstructions(storyboard: StoryboardGenerationRecord): DeliveryInstructionsPlan;
    buildRecoveryPlan(storyboard: StoryboardGenerationRecord): RecoveryPlan;
    buildProductionWorkflow(): ProductionWorkflowPlan;
    buildPlatformOptimizations(platform: StoryboardGenerationPlatform): PlatformProductionOptimization[];
    buildRecommendations(draft: VideoProductionRecordDraft): string[];
}
export interface VideoProductionRecordDraft {
    productionId: string;
    profile: ProductionProfile;
    planType: ProductionPlanType;
    workflowValidation: WorkflowValidationPlan;
    assetValidation: AssetValidationPlan;
    dependencyValidation: DependencyValidationPlan;
    productionTimeline: ProductionTimelinePlan;
    renderPreparation: RenderPreparationPlan;
    exportPreparation: ExportPreparationPlan;
    deliveryInstructions: DeliveryInstructionsPlan;
    recoveryPlan: RecoveryPlan;
    productionWorkflow: ProductionWorkflowPlan;
    platformOptimizations: PlatformProductionOptimization[];
}
//# sourceMappingURL=video-production-analyzer.d.ts.map
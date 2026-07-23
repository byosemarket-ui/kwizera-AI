import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MarketingVideoRecord } from "../marketing-video-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import type { VideoProductionRecord } from "../video-production-engine/types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
import { OUTPUT_PROFILE_CONFIG, RenderAssetValidationPlan, RenderDependencyValidationPlan, RenderJobPlan, RenderOutputPlatform, RenderPlanType, RenderProfile, RenderRecoveryPlan, RenderSettingsPlan, RenderValidationPlan, ResourcePlanningPlan, TimelineValidationPlan, OutputProfilePlan } from "./types.js";
export interface RenderingUpstreamAssets {
    scenes: SceneGenerationRecord[];
    cameraPlans: CameraDirectorRecord[];
    motionPlans: MotionGenerationRecord[];
    animationPlans: AnimationGenerationRecord[];
    visualEffectPlans: VisualEffectsGenerationRecord[];
    audioPlans: AudioSynchronizationRecord[];
    marketingPlan: MarketingVideoRecord;
    productionPlan: VideoProductionRecord;
}
export declare class RenderingPreparationAnalyzer {
    buildRenderPlan(storyboard: StoryboardGenerationRecord, upstream: RenderingUpstreamAssets, foundation: AiVideoGenerationFoundation, version: number): RenderingPreparationRecordDraft;
    buildProfile(storyboard: StoryboardGenerationRecord, productionPlan: VideoProductionRecord, version: number): RenderProfile;
    buildRenderValidation(storyboard: StoryboardGenerationRecord, upstream: RenderingUpstreamAssets): RenderValidationPlan;
    buildTimelineValidation(upstream: RenderingUpstreamAssets): TimelineValidationPlan;
    buildAssetValidation(storyboard: StoryboardGenerationRecord, upstream: RenderingUpstreamAssets): RenderAssetValidationPlan;
    buildDependencyValidation(foundation: AiVideoGenerationFoundation): RenderDependencyValidationPlan;
    buildRenderSettings(platform: StoryboardGenerationPlatform, config: (typeof OUTPUT_PROFILE_CONFIG)[RenderOutputPlatform], productionPlan: VideoProductionRecord): RenderSettingsPlan;
    buildOutputProfiles(primaryPlatform: StoryboardGenerationPlatform): OutputProfilePlan[];
    buildResourcePlanning(upstream: RenderingUpstreamAssets): ResourcePlanningPlan;
    buildRenderJobs(profile: RenderProfile, platform: StoryboardGenerationPlatform): RenderJobPlan[];
    buildRecoveryPlan(storyboard: StoryboardGenerationRecord): RenderRecoveryPlan;
    buildRecommendations(draft: RenderingPreparationRecordDraft): string[];
}
export interface RenderingPreparationRecordDraft {
    renderPlanId: string;
    profile: RenderProfile;
    planType: RenderPlanType;
    renderValidation: RenderValidationPlan;
    timelineValidation: TimelineValidationPlan;
    assetValidation: RenderAssetValidationPlan;
    dependencyValidation: RenderDependencyValidationPlan;
    renderSettings: RenderSettingsPlan;
    outputProfiles: OutputProfilePlan[];
    resourcePlanning: ResourcePlanningPlan;
    renderJobs: RenderJobPlan[];
    recoveryPlan: RenderRecoveryPlan;
}
//# sourceMappingURL=rendering-preparation-analyzer.d.ts.map
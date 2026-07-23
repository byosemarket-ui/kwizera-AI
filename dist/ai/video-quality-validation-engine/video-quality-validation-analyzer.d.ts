import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MarketingVideoRecord } from "../marketing-video-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { RenderingPreparationRecord } from "../rendering-preparation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import type { VideoProductionRecord } from "../video-production-engine/types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
import { AudioQualityValidationPlan, BrandQualityValidationPlan, ProductionReadinessValidationPlan, QualityDependencyValidationPlan, QualityIssue, QualityValidationProfile, QualityValidationType, PlatformQualityValidationPlan, TechnicalQualityValidationPlan, TextQualityValidationPlan, VideoQualityValidationPlan } from "./types.js";
export interface QualityValidationUpstreamAssets {
    scenes: SceneGenerationRecord[];
    cameraPlans: CameraDirectorRecord[];
    motionPlans: MotionGenerationRecord[];
    animationPlans: AnimationGenerationRecord[];
    visualEffectPlans: VisualEffectsGenerationRecord[];
    audioPlans: AudioSynchronizationRecord[];
    marketingPlan: MarketingVideoRecord;
    productionPlan: VideoProductionRecord;
    renderPlan: RenderingPreparationRecord;
}
export declare class VideoQualityValidationAnalyzer {
    buildValidationRecord(storyboard: StoryboardGenerationRecord, upstream: QualityValidationUpstreamAssets, foundation: AiVideoGenerationFoundation, version: number): QualityValidationRecordDraft;
    buildProfile(storyboard: StoryboardGenerationRecord, upstream: QualityValidationUpstreamAssets, version: number): QualityValidationProfile;
    buildProductionReadiness(storyboard: StoryboardGenerationRecord, upstream: QualityValidationUpstreamAssets): ProductionReadinessValidationPlan;
    buildVideoQuality(storyboard: StoryboardGenerationRecord, upstream: QualityValidationUpstreamAssets): VideoQualityValidationPlan;
    buildAudioQuality(upstream: QualityValidationUpstreamAssets): AudioQualityValidationPlan;
    buildTextQuality(upstream: QualityValidationUpstreamAssets): TextQualityValidationPlan;
    buildBrandQuality(storyboard: StoryboardGenerationRecord, upstream: QualityValidationUpstreamAssets): BrandQualityValidationPlan;
    buildPlatformValidations(primaryPlatform: StoryboardGenerationPlatform): PlatformQualityValidationPlan[];
    buildTechnicalQuality(upstream: QualityValidationUpstreamAssets): TechnicalQualityValidationPlan;
    buildDependencyValidation(foundation: AiVideoGenerationFoundation): QualityDependencyValidationPlan;
    detectIssues(storyboard: StoryboardGenerationRecord, upstream: QualityValidationUpstreamAssets, productionReadiness: ProductionReadinessValidationPlan, videoQuality: VideoQualityValidationPlan, audioQuality: AudioQualityValidationPlan, textQuality: TextQualityValidationPlan, brandQuality: BrandQualityValidationPlan, technicalQuality: TechnicalQualityValidationPlan): QualityIssue[];
    buildRecommendations(draft: QualityValidationRecordDraft): string[];
}
export interface QualityValidationRecordDraft {
    validationId: string;
    profile: QualityValidationProfile;
    validationType: QualityValidationType;
    productionReadiness: ProductionReadinessValidationPlan;
    videoQuality: VideoQualityValidationPlan;
    audioQuality: AudioQualityValidationPlan;
    textQuality: TextQualityValidationPlan;
    brandQuality: BrandQualityValidationPlan;
    platformValidations: PlatformQualityValidationPlan[];
    technicalQuality: TechnicalQualityValidationPlan;
    dependencyValidation: QualityDependencyValidationPlan;
    issues: QualityIssue[];
}
//# sourceMappingURL=video-quality-validation-analyzer.d.ts.map
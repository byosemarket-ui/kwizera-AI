import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import { AtmosphericEffectsPlan, CinematicEffectsPlan, ColorEffectsPlan, EffectSynchronization, EnvironmentEffectsPlan, LightingEffectsPlan, PlatformVisualEffectsOptimization, ProductEffectsPlan, TextGraphicEffectsPlan, TransitionEffectsPlan, VisualEffectPlanProfile, VisualEffectPlanType } from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export declare class VisualEffectsGenerationAnalyzer {
    buildVisualEffectPlan(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord, motionPlan: MotionGenerationRecord, animationPlan: AnimationGenerationRecord, version: number): VisualEffectsGenerationRecordDraft;
    buildProfile(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord, motionPlan: MotionGenerationRecord, animationPlan: AnimationGenerationRecord, version: number): VisualEffectPlanProfile;
    buildLightingEffects(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord, isHero: boolean): LightingEffectsPlan;
    buildAtmosphericEffects(scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord, animationPlan: AnimationGenerationRecord): AtmosphericEffectsPlan;
    buildProductEffects(scene: SceneGenerationRecord, animationPlan: AnimationGenerationRecord, isProduct: boolean): ProductEffectsPlan;
    buildEnvironmentEffects(scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord, animationPlan: AnimationGenerationRecord): EnvironmentEffectsPlan;
    buildTransitionEffects(scene: SceneGenerationRecord, animationPlan: AnimationGenerationRecord): TransitionEffectsPlan;
    buildTextGraphicEffects(scene: SceneGenerationRecord, animationPlan: AnimationGenerationRecord): TextGraphicEffectsPlan;
    buildColorEffects(scene: SceneGenerationRecord): ColorEffectsPlan;
    buildCinematicEffects(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord): CinematicEffectsPlan;
    buildSynchronization(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord, motionPlan: MotionGenerationRecord, animationPlan: AnimationGenerationRecord): EffectSynchronization;
    buildPlatformOptimizations(platform: StoryboardGenerationPlatform): PlatformVisualEffectsOptimization[];
    buildRecommendations(draft: VisualEffectsGenerationRecordDraft): string[];
}
export interface VisualEffectsGenerationRecordDraft {
    visualEffectPlanId: string;
    profile: VisualEffectPlanProfile;
    planType: VisualEffectPlanType;
    lightingEffects: LightingEffectsPlan;
    atmosphericEffects: AtmosphericEffectsPlan;
    productEffects: ProductEffectsPlan;
    environmentEffects: EnvironmentEffectsPlan;
    transitionEffects: TransitionEffectsPlan;
    textGraphicEffects: TextGraphicEffectsPlan;
    colorEffects: ColorEffectsPlan;
    cinematicEffects: CinematicEffectsPlan;
    synchronization: EffectSynchronization;
    platformOptimizations: PlatformVisualEffectsOptimization[];
}
//# sourceMappingURL=visual-effects-generation-analyzer.d.ts.map
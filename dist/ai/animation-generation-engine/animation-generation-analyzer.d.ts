import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import { AnimationPlanProfile, AnimationPlanType, AnimationSynchronization, AnimationTimeline, CharacterAnimationPlan, EnvironmentAnimationPlan, LogoAnimationPlan, ObjectAnimationPlan, PlatformAnimationOptimization, ProductAnimationPlan, TextAnimationPlan, TransitionAnimationPlan, StoryboardGenerationPlatform } from "./types.js";
export declare class AnimationGenerationAnalyzer {
    buildAnimationPlan(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord, motionPlan: MotionGenerationRecord, version: number): AnimationGenerationRecordDraft;
    buildProfile(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord, motionPlan: MotionGenerationRecord, version: number): AnimationPlanProfile;
    buildCharacterAnimation(scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord, active: boolean): CharacterAnimationPlan;
    buildProductAnimation(scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord, isHero: boolean): ProductAnimationPlan;
    buildObjectAnimation(scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord): ObjectAnimationPlan;
    buildTextAnimation(scene: SceneGenerationRecord, purpose: string): TextAnimationPlan;
    buildLogoAnimation(scene: SceneGenerationRecord): LogoAnimationPlan;
    buildEnvironmentAnimation(motionPlan: MotionGenerationRecord): EnvironmentAnimationPlan;
    buildTransitionAnimation(scene: SceneGenerationRecord): TransitionAnimationPlan;
    buildTimeline(scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord): AnimationTimeline;
    buildSynchronization(motionPlan: MotionGenerationRecord, cameraPlan: CameraDirectorRecord, scene: SceneGenerationRecord): AnimationSynchronization;
    buildPlatformOptimizations(platform: StoryboardGenerationPlatform): PlatformAnimationOptimization[];
    buildRecommendations(draft: AnimationGenerationRecordDraft): string[];
}
export interface AnimationGenerationRecordDraft {
    animationPlanId: string;
    profile: AnimationPlanProfile;
    planType: AnimationPlanType;
    characterAnimation: CharacterAnimationPlan;
    productAnimation: ProductAnimationPlan;
    objectAnimation: ObjectAnimationPlan;
    textAnimation: TextAnimationPlan;
    logoAnimation: LogoAnimationPlan;
    environmentAnimation: EnvironmentAnimationPlan;
    transitionAnimation: TransitionAnimationPlan;
    timeline: AnimationTimeline;
    synchronization: AnimationSynchronization;
    platformOptimizations: PlatformAnimationOptimization[];
}
//# sourceMappingURL=animation-generation-analyzer.d.ts.map
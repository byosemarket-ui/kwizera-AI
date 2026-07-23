import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import { CameraSynchronization, CharacterMotionPlan, EnvironmentMotionPlan, MotionContinuity, MotionPlanProfile, MotionTiming, MotionType, ObjectMotionPlan, PlatformMotionOptimization, ProductMotionPlan, StoryboardGenerationPlatform } from "./types.js";
export declare class MotionGenerationAnalyzer {
    buildMotionPlan(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord, version: number): MotionGenerationRecordDraft;
    buildProfile(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord, version: number): MotionPlanProfile;
    buildCharacterMotion(scene: SceneGenerationRecord, active: boolean): CharacterMotionPlan;
    buildProductMotion(scene: SceneGenerationRecord, isHero: boolean): ProductMotionPlan;
    buildObjectMotion(scene: SceneGenerationRecord): ObjectMotionPlan;
    buildCameraSync(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord): CameraSynchronization;
    buildEnvironmentMotion(scene: SceneGenerationRecord): EnvironmentMotionPlan;
    buildMotionTiming(scene: SceneGenerationRecord): MotionTiming;
    buildContinuity(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord): MotionContinuity;
    buildPlatformOptimizations(platform: StoryboardGenerationPlatform): PlatformMotionOptimization[];
    buildStorytellingOptimization(scene: SceneGenerationRecord): MotionGenerationRecordDraft["storytellingOptimization"];
    buildRecommendations(draft: MotionGenerationRecordDraft): string[];
}
export interface MotionGenerationRecordDraft {
    motionPlanId: string;
    profile: MotionPlanProfile;
    motionType: MotionType;
    characterMotion: CharacterMotionPlan;
    productMotion: ProductMotionPlan;
    objectMotion: ObjectMotionPlan;
    cameraSynchronization: CameraSynchronization;
    environmentMotion: EnvironmentMotionPlan;
    motionTiming: MotionTiming;
    continuity: MotionContinuity;
    platformOptimizations: PlatformMotionOptimization[];
    storytellingOptimization: {
        narrativeBeat: string;
        emotionalArc: string;
        marketingMoment: string;
    };
}
//# sourceMappingURL=motion-generation-analyzer.d.ts.map
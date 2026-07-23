import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { GeneratedScene } from "../story-generation-engine/types.js";
import { CharacterPlanning, ObjectPlanning, SceneAudioPlanning, SceneGenerationProfile, SceneGenerationRecord, ScenePlatformOptimization, SceneShot, SceneStructure, StoryboardGenerationPlatform, TransitionPlanning, VisualGenerationPlan } from "./types.js";
export declare class SceneGenerationAnalyzer {
    buildSceneRecord(storyboard: StoryboardGenerationRecord, sourceScene: GeneratedScene, version: number): Omit<SceneGenerationRecord, "scores" | "relationships" | "recommendations" | "validated" | "productionReady" | "marketingReady" | "brandConsistent" | "createdAt" | "lastUpdated">;
    buildProfile(storyboard: StoryboardGenerationRecord, sourceScene: GeneratedScene, version: number): SceneGenerationProfile;
    buildStructure(sourceScene: GeneratedScene): SceneStructure;
    buildShots(sourceScene: GeneratedScene): SceneShot[];
    buildVisualPlan(storyboard: StoryboardGenerationRecord, sourceScene: GeneratedScene): VisualGenerationPlan;
    buildCharacterPlanning(sourceScene: GeneratedScene, storyboard: StoryboardGenerationRecord): CharacterPlanning;
    buildObjectPlanning(sourceScene: GeneratedScene, storyboard: StoryboardGenerationRecord): ObjectPlanning;
    buildAudioPlanning(storyboard: StoryboardGenerationRecord, sourceScene: GeneratedScene): SceneAudioPlanning;
    buildTransitionPlanning(sourceScene: GeneratedScene, storyboard: StoryboardGenerationRecord): TransitionPlanning;
    buildCameraPlanning(shots: SceneShot[]): SceneGenerationRecord["cameraPlanning"];
    buildMotionPlanning(sourceScene: GeneratedScene, shots: SceneShot[]): SceneGenerationRecord["motionPlanning"];
    buildLayout(sourceScene: GeneratedScene, storyboard: StoryboardGenerationRecord): SceneGenerationRecord["layout"];
    buildPlatformOptimizations(primaryPlatform: StoryboardGenerationPlatform, sourceScene: GeneratedScene): ScenePlatformOptimization[];
    buildRecommendations(record: Omit<SceneGenerationRecord, "scores" | "relationships" | "recommendations" | "validated" | "productionReady" | "marketingReady" | "brandConsistent" | "createdAt" | "lastUpdated">): string[];
    private resolveFocusPoint;
}
//# sourceMappingURL=scene-generation-analyzer.d.ts.map
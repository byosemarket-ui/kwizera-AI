import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import { CameraPlanProfile, CompositionPlanning, ContinuityPlanning, DirectorCameraAngle, DirectorShotPlan, FocusPlanning, PlatformCameraOptimization, StoryboardGenerationPlatform } from "./types.js";
export declare class CameraDirectorAnalyzer {
    buildCameraPlan(scene: SceneGenerationRecord, storyboard: StoryboardGenerationRecord | null, version: number): Omit<CameraDirectorRecordDraft, "scores" | "relationships" | "recommendations" | "validated" | "productionReady" | "brandConsistent" | "cinematicallyConsistent" | "createdAt" | "lastUpdated">;
    buildProfile(scene: SceneGenerationRecord, version: number): CameraPlanProfile;
    buildShotPlans(scene: SceneGenerationRecord): DirectorShotPlan[];
    buildFocusPlanning(scene: SceneGenerationRecord): FocusPlanning;
    buildCompositionPlanning(scene: SceneGenerationRecord, storyboard: StoryboardGenerationRecord | null): CompositionPlanning;
    buildContinuity(scene: SceneGenerationRecord, storyboard: StoryboardGenerationRecord | null): ContinuityPlanning;
    buildPlatformOptimizations(primaryPlatform: StoryboardGenerationPlatform): PlatformCameraOptimization[];
    buildMarketingImpact(scene: SceneGenerationRecord): CameraDirectorRecordDraft["marketingImpact"];
    buildRecommendations(draft: CameraDirectorRecordDraft): string[];
    private enhanceMovement;
}
export interface CameraDirectorRecordDraft {
    cameraPlanId: string;
    profile: CameraPlanProfile;
    shotPlans: DirectorShotPlan[];
    focusPlanning: FocusPlanning;
    compositionPlanning: CompositionPlanning;
    continuity: ContinuityPlanning;
    platformOptimizations: PlatformCameraOptimization[];
    marketingImpact: {
        heroMoment: string;
        productRevealAngle: DirectorCameraAngle;
        brandVisibilityZone: string;
        conversionFraming: string;
    };
}
//# sourceMappingURL=camera-director-analyzer.d.ts.map
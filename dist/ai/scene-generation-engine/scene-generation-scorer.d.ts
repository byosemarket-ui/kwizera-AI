import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import { SceneGenerationRecord, SceneGenerationScores, SceneStructure } from "./types.js";
export declare class SceneGenerationScorer {
    computeScores(record: Omit<SceneGenerationRecord, "scores" | "relationships" | "recommendations" | "validated" | "productionReady" | "marketingReady" | "brandConsistent" | "createdAt" | "lastUpdated">, storyboard: StoryboardGenerationRecord): SceneGenerationScores;
    isSceneValid(scores: SceneGenerationScores, record: Pick<SceneGenerationRecord, "structure" | "shots">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: SceneGenerationScores, record: Pick<SceneGenerationRecord, "shots" | "visualPlan" | "audioPlanning">): boolean;
    isMarketingReady(structure: SceneStructure): boolean;
    isBrandConsistent(scores: SceneGenerationScores): boolean;
    private computeSceneQuality;
    private computeCompositionScore;
    private computeCinematicScore;
    private computeBrandScore;
    private computeProductionReadiness;
}
//# sourceMappingURL=scene-generation-scorer.d.ts.map
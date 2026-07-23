import { AmbientSoundPlan, AmbientAudioGenerationRecord, AmbientAudioScores, AmbientSyncPlan, AmbientTimelinePlan, EnvironmentAnalysis, IndoorAmbiencePlan, ProductionAmbientInstructions, SpatialAudioPlan, UrbanAmbiencePlan, WeatherAmbiencePlan } from "./types.js";
import type { AmbientContext } from "./ambient-audio-generation-analyzer.js";
export declare class AmbientAudioGenerationScorer {
    computeScores(analysis: EnvironmentAnalysis, ambientPlan: AmbientSoundPlan, urbanPlan: UrbanAmbiencePlan, indoorPlan: IndoorAmbiencePlan, weatherPlan: WeatherAmbiencePlan, spatialPlan: SpatialAudioPlan, timelinePlan: AmbientTimelinePlan, syncPlan: AmbientSyncPlan, productionInstructions: ProductionAmbientInstructions, context: AmbientContext): AmbientAudioScores;
    isAmbientPlanValid(scores: AmbientAudioScores, record: Pick<AmbientAudioGenerationRecord, "environmentAnalysis" | "ambientSoundPlan" | "weatherAmbiencePlan" | "spatialAudioPlan" | "timelinePlan" | "syncPreparation">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: AmbientAudioScores, record: AmbientAudioGenerationRecord): boolean;
    isBrandConsistent(context: AmbientContext, instructions: ProductionAmbientInstructions): boolean;
    private computeEnvironmentalRealism;
    private computeImmersionScore;
    private computeSpatialAudioScore;
    private computeSynchronizationScore;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=ambient-audio-generation-scorer.d.ts.map
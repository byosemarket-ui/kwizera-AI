import { CinematicSoundPlan, EnvironmentalSoundPlan, FoleyPlan, SoundAnalysis, SoundEffectPlan, SoundEffectsGenerationRecord, SoundEffectsScores, SyncPreparationPlan, TimelinePlan, ProductionSfxInstructions } from "./types.js";
import type { SfxContext } from "./sound-effects-generation-analyzer.js";
export declare class SoundEffectsGenerationScorer {
    computeScores(analysis: SoundAnalysis, soundEffectPlan: SoundEffectPlan, foleyPlan: FoleyPlan, environmentalPlan: EnvironmentalSoundPlan, cinematicPlan: CinematicSoundPlan, timelinePlan: TimelinePlan, syncPlan: SyncPreparationPlan, productionInstructions: ProductionSfxInstructions, context: SfxContext): SoundEffectsScores;
    isSoundPlanValid(scores: SoundEffectsScores, record: Pick<SoundEffectsGenerationRecord, "soundAnalysis" | "soundEffectPlan" | "foleyPlan" | "environmentalPlan" | "timelinePlan" | "syncPreparation">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: SoundEffectsScores, record: SoundEffectsGenerationRecord): boolean;
    isBrandConsistent(context: SfxContext, instructions: ProductionSfxInstructions): boolean;
    private totalSoundLayers;
    private computeRealismScore;
    private computeSynchronizationScore;
    private computeLayerQualityScore;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=sound-effects-generation-scorer.d.ts.map
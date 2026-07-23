import { AudioMixMasterGenerationRecord, AudioMixMasterScores, FrequencyManagementPlan, LoudnessManagementPlan, MasteringPlan, MixingPlan, MultiTrackAnalysis, ProductionMixMasterInstructions, SpatialMixPlan } from "./types.js";
import type { MixMasterContext } from "./audio-mixing-mastering-analyzer.js";
export declare class AudioMixingMasteringScorer {
    computeScores(analysis: MultiTrackAnalysis, mixing: MixingPlan, mastering: MasteringPlan, frequency: FrequencyManagementPlan, loudness: LoudnessManagementPlan, spatial: SpatialMixPlan, productionInstructions: ProductionMixMasterInstructions, context: MixMasterContext): AudioMixMasterScores;
    isMixMasterPlanValid(scores: AudioMixMasterScores, record: Pick<AudioMixMasterGenerationRecord, "multiTrackAnalysis" | "mixingPlan" | "masteringPlan" | "loudnessManagement" | "spatialMixPlan">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: AudioMixMasterScores, record: AudioMixMasterGenerationRecord): boolean;
    isBrandConsistent(context: MixMasterContext, instructions: ProductionMixMasterInstructions): boolean;
    private computeMixingScore;
    private computeMasteringScore;
    private computeLoudnessScore;
    private computeFrequencyScore;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=audio-mixing-mastering-scorer.d.ts.map
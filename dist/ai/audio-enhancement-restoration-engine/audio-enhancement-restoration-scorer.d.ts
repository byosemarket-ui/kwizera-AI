import { AudioEnhancementGenerationRecord, AudioEnhancementScores, AudioQualityAnalysis, AudioSyncPlan, EnhancementPlan, MusicImprovementPlan, ProductionEnhancementInstructions, RestorationPlan, VoiceImprovementPlan } from "./types.js";
import type { EnhancementContext } from "./audio-enhancement-restoration-analyzer.js";
export declare class AudioEnhancementRestorationScorer {
    computeScores(analysis: AudioQualityAnalysis, enhancement: EnhancementPlan, restoration: RestorationPlan, voicePlan: VoiceImprovementPlan, musicPlan: MusicImprovementPlan, syncPlan: AudioSyncPlan, productionInstructions: ProductionEnhancementInstructions, context: EnhancementContext): AudioEnhancementScores;
    isEnhancementPlanValid(scores: AudioEnhancementScores, record: Pick<AudioEnhancementGenerationRecord, "audioQualityAnalysis" | "enhancementPlan" | "restorationPlan" | "syncPlan" | "voiceImprovementPlan">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: AudioEnhancementScores, record: AudioEnhancementGenerationRecord): boolean;
    isBrandConsistent(context: EnhancementContext, instructions: ProductionEnhancementInstructions): boolean;
    private computeClarityScore;
    private computeRestorationScore;
    private computeNoiseReductionScore;
    private computeSynchronizationScore;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=audio-enhancement-restoration-scorer.d.ts.map
import { ArrangementPlan, CompositionPlan, MoodPlan, MusicAnalysis, MusicGenerationRecord, MusicGenerationScores, ProductionMusicInstructions, SyncPreparationPlan } from "./types.js";
import type { MusicContext } from "./music-generation-analyzer.js";
export declare class MusicGenerationScorer {
    computeScores(analysis: MusicAnalysis, composition: CompositionPlan, arrangement: ArrangementPlan, moodPlan: MoodPlan, syncPlan: SyncPreparationPlan, productionInstructions: ProductionMusicInstructions, context: MusicContext): MusicGenerationScores;
    isMusicPlanValid(scores: MusicGenerationScores, record: Pick<MusicGenerationRecord, "musicAnalysis" | "compositionPlan" | "arrangementPlan" | "moodPlan" | "syncPreparation">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: MusicGenerationScores, record: MusicGenerationRecord): boolean;
    isBrandConsistent(context: MusicContext, moodPlan: MoodPlan): boolean;
    private computeCompositionScore;
    private computeHarmonyScore;
    private computeRhythmScore;
    private computeEmotionalScore;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=music-generation-scorer.d.ts.map
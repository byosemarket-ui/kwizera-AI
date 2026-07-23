import { SynchronizationState, TimelineOptimization, TimelineQualityScores } from "./types.js";
export declare class TimelineIntelligenceScorer {
    computeScores(timelineLengthMs: number, sceneCount: number, shotCount: number, trackCount: number, variantCount: number, synchronization: SynchronizationState, optimization: TimelineOptimization, editingReadiness: number, renderingReadiness: number, frameConsistencyScore: number): TimelineQualityScores;
    isTimelineValid(scores: TimelineQualityScores, sceneCount: number, trackCount: number): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=timeline-intelligence-scorer.d.ts.map
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { OptimizationUpstreamAssets, OptimizationRecordDraft } from "./video-generation-optimization-analyzer.js";
import { OptimizationScores } from "./types.js";
export declare class VideoGenerationOptimizationScorer {
    computeScores(draft: OptimizationRecordDraft, storyboard: StoryboardGenerationRecord, upstream: OptimizationUpstreamAssets): OptimizationScores;
    isOptimizationValid(scores: OptimizationScores, draft: OptimizationRecordDraft): {
        valid: boolean;
        diagnostics: string[];
    };
    isApproved(scores: OptimizationScores, draft: OptimizationRecordDraft): boolean;
    isBrandConsistent(storyboard: StoryboardGenerationRecord, upstream: OptimizationUpstreamAssets): boolean;
    private computeOptimizationScore;
    private computePerformanceScore;
    private computeResourceEfficiency;
    private computeQualityImprovement;
    private computeProductionReadiness;
}
//# sourceMappingURL=video-generation-optimization-scorer.d.ts.map
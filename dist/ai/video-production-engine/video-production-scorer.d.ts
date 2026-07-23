import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { ProductionUpstreamAssets, VideoProductionRecordDraft } from "./video-production-analyzer.js";
import { VideoProductionScores } from "./types.js";
export declare class VideoProductionScorer {
    computeScores(draft: VideoProductionRecordDraft, storyboard: StoryboardGenerationRecord, upstream: ProductionUpstreamAssets): VideoProductionScores;
    isPlanValid(scores: VideoProductionScores, draft: VideoProductionRecordDraft): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: VideoProductionScores, draft: VideoProductionRecordDraft): boolean;
    isBrandConsistent(storyboard: StoryboardGenerationRecord, upstream: ProductionUpstreamAssets): boolean;
    private computeProductionReadiness;
    private computeAssetReadiness;
    private computeWorkflow;
    private computeTimeline;
    private computeDependency;
    private computePerformance;
}
//# sourceMappingURL=video-production-scorer.d.ts.map
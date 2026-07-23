import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { RenderingUpstreamAssets, RenderingPreparationRecordDraft } from "./rendering-preparation-analyzer.js";
import { RenderingPreparationScores } from "./types.js";
export declare class RenderingPreparationScorer {
    computeScores(draft: RenderingPreparationRecordDraft, storyboard: StoryboardGenerationRecord, _upstream: RenderingUpstreamAssets): RenderingPreparationScores;
    isPlanValid(scores: RenderingPreparationScores, draft: RenderingPreparationRecordDraft): {
        valid: boolean;
        diagnostics: string[];
    };
    isRenderReady(scores: RenderingPreparationScores, draft: RenderingPreparationRecordDraft): boolean;
    isBrandConsistent(storyboard: StoryboardGenerationRecord, upstream: RenderingUpstreamAssets): boolean;
    private computeRenderReadiness;
    private computeAssetQuality;
    private computeTimelineIntegrity;
    private computePerformance;
    private computePlatformCompatibility;
}
//# sourceMappingURL=rendering-preparation-scorer.d.ts.map
import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { MarketingVideoRecordDraft } from "./marketing-video-analyzer.js";
import { MarketingVideoScores } from "./types.js";
export declare class MarketingVideoScorer {
    computeScores(draft: MarketingVideoRecordDraft, storyboard: StoryboardGenerationRecord, scenes: SceneGenerationRecord[], audioPlans: AudioSynchronizationRecord[]): MarketingVideoScores;
    isPlanValid(scores: MarketingVideoScores, draft: MarketingVideoRecordDraft): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: MarketingVideoScores, draft: MarketingVideoRecordDraft): boolean;
    isMarketingReady(scores: MarketingVideoScores, storyboard: StoryboardGenerationRecord): boolean;
    isBrandConsistent(storyboard: StoryboardGenerationRecord, scenes: SceneGenerationRecord[]): boolean;
    private computeMarketingQuality;
    private computeEngagement;
    private computeConversion;
    private computeBrandConsistency;
    private computePlatformReadiness;
}
//# sourceMappingURL=marketing-video-scorer.d.ts.map
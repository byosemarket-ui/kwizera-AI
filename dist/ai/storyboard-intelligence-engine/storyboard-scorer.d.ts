import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import { ContinuityCheck, ScenePlan, StoryboardScores, StoryFlow, TimingIntelligence } from "./types.js";
export declare class StoryboardScorer {
    computeScores(scenes: ScenePlan[], storyFlow: StoryFlow, timing: TimingIntelligence, continuity: ContinuityCheck, creative: CreativeDirectionRecord, strategy: MarketingStrategyRecord): StoryboardScores;
    isStoryboardValid(scores: StoryboardScores, scenes: ScenePlan[], continuity: ContinuityCheck): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scenes: ScenePlan[], continuity: ContinuityCheck, scores: StoryboardScores): boolean;
    private computeStoryboardQuality;
    private computeStorytellingScore;
    private computeVisualPlanningScore;
    private computeBrandScore;
}
//# sourceMappingURL=storyboard-scorer.d.ts.map
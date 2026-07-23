import { GeneratedScene, StoryboardGenerationScores, StoryStructure, VisualPlanning, AudioPlanning, MarketingPlanning, CinematicPlanning, PlatformStoryboardVariation } from "./types.js";
import type { GenerationContext } from "./story-generation-analyzer.js";
export declare class StoryGenerationScorer {
    computeScores(scenes: GeneratedScene[], storyStructure: StoryStructure, visualPlanning: VisualPlanning, audioPlanning: AudioPlanning, marketingPlanning: MarketingPlanning, cinematicPlanning: CinematicPlanning, platformVariations: PlatformStoryboardVariation[], context: GenerationContext): StoryboardGenerationScores;
    isStoryboardValid(scores: StoryboardGenerationScores, scenes: GeneratedScene[]): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: StoryboardGenerationScores, scenes: GeneratedScene[]): boolean;
    isMarketingReady(scores: StoryboardGenerationScores, storyStructure: StoryStructure): boolean;
    isBrandConsistent(context: GenerationContext, visualPlanning: VisualPlanning): boolean;
    private computeStoryQuality;
    private computeMarketingScore;
    private computeCreativeScore;
    private computeCinematicScore;
    private computeProductionReadiness;
}
//# sourceMappingURL=story-generation-scorer.d.ts.map
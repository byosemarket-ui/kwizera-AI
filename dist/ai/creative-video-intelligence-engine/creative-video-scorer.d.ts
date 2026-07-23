import { CreativeQualityScores, StoryboardPlan } from "./types.js";
export declare class CreativeVideoScorer {
    computeScores(storyboard: StoryboardPlan, recommendationCount: number, templateMatchScore: number, storytellingBase: number, marketingBase: number, brandConsistency: number, productionBase: number): CreativeQualityScores;
    isPlanValid(scores: CreativeQualityScores, sceneCount: number, recommendationCount: number, templateCount: number): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=creative-video-scorer.d.ts.map
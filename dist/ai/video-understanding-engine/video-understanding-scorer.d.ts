import { AudienceUnderstanding, BrandUnderstanding, MarketingUnderstanding, ProductUnderstanding, StoryUnderstanding, VideoPurpose, VideoUnderstandingScores } from "./types.js";
export declare class VideoUnderstandingScorer {
    computeScores(purpose: VideoPurpose, story: StoryUnderstanding, product: ProductUnderstanding, brand: BrandUnderstanding, audience: AudienceUnderstanding, marketing: MarketingUnderstanding, productionReadinessScore: number): VideoUnderstandingScores;
    isUnderstandingValid(scores: VideoUnderstandingScores, purpose: VideoPurpose): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=video-understanding-scorer.d.ts.map
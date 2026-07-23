import { AnimationKnowledge, CinematicKnowledge, CreativeAnalysisInput, CreativeStorytellingKnowledge, KnowledgeCreativeDirectionStyle, KnowledgeCreativeDomain, KnowledgeCreativeMarketingGoal, KnowledgeCreativePlatform, SocialCreativeKnowledge, VisualDesignKnowledge } from "./types.js";
export declare class CreativeAnalyzer {
    analyze(input: CreativeAnalysisInput): {
        domain: KnowledgeCreativeDomain;
        creativeStyle: KnowledgeCreativeDirectionStyle;
        platform: KnowledgeCreativePlatform;
        industry: string;
        brandName: string;
        productName: string;
        marketingGoal: KnowledgeCreativeMarketingGoal;
        colorPalette: string[];
        animationStyle: string;
        visual: VisualDesignKnowledge;
        storytelling: CreativeStorytellingKnowledge;
        animation: AnimationKnowledge;
        cinematic: CinematicKnowledge;
        social: SocialCreativeKnowledge;
    };
    private defaultFormat;
    private defaultAspectRatio;
    private defaultBestPractices;
}
//# sourceMappingURL=creative-analyzer.d.ts.map
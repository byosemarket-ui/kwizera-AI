import { BrandAnalysisInput, BrandCommunicationKnowledge, BrandConsistencyCheck, BrandIdentityProfile, BrandMarketingStyle, VisualBrandKnowledge } from "./types.js";
export declare class BrandAnalyzer {
    analyze(input: BrandAnalysisInput): {
        profile: BrandIdentityProfile;
        visual: VisualBrandKnowledge;
        communication: BrandCommunicationKnowledge;
        marketingStyle: BrandMarketingStyle;
        history: string[];
        consistency: BrandConsistencyCheck;
    };
    evaluateConsistency(profile: BrandIdentityProfile, visual: VisualBrandKnowledge, communication: BrandCommunicationKnowledge, input: BrandAnalysisInput): BrandConsistencyCheck;
}
//# sourceMappingURL=brand-analyzer.d.ts.map
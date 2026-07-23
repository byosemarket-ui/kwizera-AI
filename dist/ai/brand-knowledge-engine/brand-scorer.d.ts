import { BrandCommunicationKnowledge, BrandConsistencyCheck, BrandIdentityProfile, BrandKnowledgeQualityScores, VisualBrandKnowledge } from "./types.js";
export declare class BrandScorer {
    computeScores(profile: BrandIdentityProfile, visual: VisualBrandKnowledge, communication: BrandCommunicationKnowledge, consistency: BrandConsistencyCheck): BrandKnowledgeQualityScores;
    isAnalysisValid(profile: BrandIdentityProfile, scores: BrandKnowledgeQualityScores, consistency: BrandConsistencyCheck): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=brand-scorer.d.ts.map
import { AnimationKnowledge, CinematicKnowledge, CreativeKnowledgeQualityScores, CreativeStorytellingKnowledge, VisualDesignKnowledge } from "./types.js";
export declare class CreativeScorer {
    computeScores(visual: VisualDesignKnowledge, storytelling: CreativeStorytellingKnowledge, animation: AnimationKnowledge, cinematic: CinematicKnowledge, brandConsistency: number): CreativeKnowledgeQualityScores;
    isAnalysisValid(scores: CreativeKnowledgeQualityScores): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=creative-scorer.d.ts.map
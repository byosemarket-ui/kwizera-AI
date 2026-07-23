import { AudioKnowledge, EditingKnowledge, MarketingKnowledge, VideoQualityScores, VideoStructureKnowledge, VisualProductionKnowledge } from "./types.js";
export declare class VideoScorer {
    computeScores(structure: VideoStructureKnowledge, editing: EditingKnowledge, audio: AudioKnowledge, marketing: MarketingKnowledge, visual: VisualProductionKnowledge): VideoQualityScores;
    isAnalysisValid(scores: VideoQualityScores): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=video-scorer.d.ts.map
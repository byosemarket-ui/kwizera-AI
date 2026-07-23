import { LanguageGrammarKnowledge, LanguageKnowledgeQualityScores, LanguageLocalizationKnowledge, LanguageMarketingKnowledge, LanguageSubtitleKnowledge, LanguageWritingStyle } from "./types.js";
export declare class LanguageScorer {
    computeScores(grammar: LanguageGrammarKnowledge, marketing: LanguageMarketingKnowledge, subtitles: LanguageSubtitleKnowledge, localization: LanguageLocalizationKnowledge, content: string, writingStyle: LanguageWritingStyle): LanguageKnowledgeQualityScores;
    isAnalysisValid(content: string, scores: LanguageKnowledgeQualityScores): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=language-scorer.d.ts.map
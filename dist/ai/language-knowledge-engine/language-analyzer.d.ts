import { KnowledgeSupportedLanguage, LanguageAnalysisInput, LanguageGrammarKnowledge, LanguageLocalizationKnowledge, LanguageMarketingGoal, LanguageMarketingKnowledge, LanguageScriptType, LanguageSubtitleKnowledge, LanguageVoiceKnowledge, LanguageWritingStyle } from "./types.js";
export declare class LanguageAnalyzer {
    analyze(input: LanguageAnalysisInput): {
        language: KnowledgeSupportedLanguage;
        detectedLanguage: KnowledgeSupportedLanguage;
        topic: string;
        industry: string;
        brandName: string;
        productName: string;
        audience: string;
        marketingGoal: LanguageMarketingGoal;
        writingStyle: LanguageWritingStyle;
        scriptType: LanguageScriptType;
        content: string;
        grammar: LanguageGrammarKnowledge;
        marketing: LanguageMarketingKnowledge;
        voice: LanguageVoiceKnowledge;
        subtitles: LanguageSubtitleKnowledge;
        localization: LanguageLocalizationKnowledge;
    };
    detectLanguage(text: string, hint?: KnowledgeSupportedLanguage): KnowledgeSupportedLanguage;
    private defaultContent;
    private estimateGrammarScore;
    private detectGrammarIssues;
    private splitForSubtitles;
}
//# sourceMappingURL=language-analyzer.d.ts.map
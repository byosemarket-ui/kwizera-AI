import { LanguageAnalysisRecord, LanguageKnowledgeLearningPattern } from "./types.js";
import { LanguagePatternStore } from "./language-stores.js";
import { LanguageKnowledgeLogger } from "./language-logger.js";
export declare class LanguageLearner {
    private readonly patterns;
    private readonly logger;
    constructor(patterns: LanguagePatternStore, logger: LanguageKnowledgeLogger);
    learnFromAnalysis(record: LanguageAnalysisRecord): LanguageKnowledgeLearningPattern[];
    private createPattern;
}
//# sourceMappingURL=language-learner.d.ts.map
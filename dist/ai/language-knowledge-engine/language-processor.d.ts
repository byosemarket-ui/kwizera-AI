import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { LanguageAnalyzer } from "./language-analyzer.js";
import { LanguageLearner } from "./language-learner.js";
import { LanguageKnowledgeLogger } from "./language-logger.js";
import { LanguageRelationshipLinker, LanguageRecommender } from "./language-recommender.js";
import { LanguageScorer } from "./language-scorer.js";
import { LanguageRecordStore } from "./language-stores.js";
import { LanguageAnalysisInput, LanguageAnalysisRecord, LanguageAnalysisResult, LanguageSearchQuery } from "./types.js";
export declare class LanguageProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly recommender;
    private readonly linker;
    private readonly learner;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, analyzer: LanguageAnalyzer, scorer: LanguageScorer, recommender: LanguageRecommender, linker: LanguageRelationshipLinker, learner: LanguageLearner, records: LanguageRecordStore, logger: LanguageKnowledgeLogger);
    analyze(input: LanguageAnalysisInput): Promise<LanguageAnalysisResult>;
    search(query: LanguageSearchQuery): Promise<LanguageAnalysisRecord[]>;
    private filterLocal;
    private ensureGraphNode;
    private buildKnowledgeDescription;
}
//# sourceMappingURL=language-processor.d.ts.map
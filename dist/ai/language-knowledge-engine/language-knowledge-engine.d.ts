import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { LanguageKnowledgeLogger } from "./language-logger.js";
import { LanguagePatternStore, LanguageRecordStore } from "./language-stores.js";
import { KnowledgeSupportedLanguage, LanguageAnalysisInput, LanguageAnalysisRecord, LanguageAnalysisResult, LanguageKnowledgeLearningPattern, LanguageKnowledgeRecommendation, LanguageKnowledgeStatusReport, LanguageSearchQuery } from "./types.js";
/**
 * Language Knowledge Engine — understands and improves language, writing and marketing communication.
 */
export declare class AiLanguageKnowledgeEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: LanguageKnowledgeLogger;
    readonly patterns: LanguagePatternStore;
    readonly records: LanguageRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly recommender;
    private readonly linker;
    private processor;
    private learner;
    private analysisTimes;
    private searchTimes;
    private recommendationTimes;
    initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeLanguage(input: LanguageAnalysisInput): Promise<LanguageAnalysisResult>;
    detectLanguage(text: string, hint?: KnowledgeSupportedLanguage): KnowledgeSupportedLanguage;
    getLanguageRecord(languageId: string): LanguageAnalysisRecord | null;
    searchLanguages(query: LanguageSearchQuery): Promise<LanguageAnalysisRecord[]>;
    getRecommendations(languageId: string): LanguageKnowledgeRecommendation[];
    detectRelationships(languageId: string): import("./types.js").LanguageKnowledgeRelationships | null;
    getLearnedPatterns(): LanguageKnowledgeLearningPattern[];
    buildStatusReport(): LanguageKnowledgeStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=language-knowledge-engine.d.ts.map
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { CreativeKnowledgeLogger } from "./creative-logger.js";
import { CreativePatternStore, CreativeRecordStore } from "./creative-stores.js";
import { CreativeAnalysisInput, CreativeAnalysisRecord, CreativeAnalysisResult, CreativeKnowledgeLearningPattern, CreativeKnowledgeRecommendation, CreativeKnowledgeStatusReport, CreativeSearchQuery } from "./types.js";
/**
 * Creative Knowledge Engine — central creative intelligence for visual content design.
 */
export declare class AiCreativeKnowledgeEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: CreativeKnowledgeLogger;
    readonly patterns: CreativePatternStore;
    readonly records: CreativeRecordStore;
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
    analyzeCreative(input: CreativeAnalysisInput): Promise<CreativeAnalysisResult>;
    getCreative(creativeId: string): CreativeAnalysisRecord | null;
    searchCreatives(query: CreativeSearchQuery): Promise<CreativeAnalysisRecord[]>;
    getRecommendations(creativeId: string): CreativeKnowledgeRecommendation[];
    detectRelationships(creativeId: string): import("./types.js").CreativeKnowledgeRelationships | null;
    getLearnedPatterns(): CreativeKnowledgeLearningPattern[];
    buildStatusReport(): CreativeKnowledgeStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=creative-knowledge-engine.d.ts.map
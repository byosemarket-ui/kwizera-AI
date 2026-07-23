import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { MarketingKnowledgeLogger } from "./marketing-logger.js";
import { MarketingPatternStore, MarketingRecordStore } from "./marketing-stores.js";
import { MarketingAnalysisInput, MarketingAnalysisRecord, MarketingAnalysisResult, MarketingKnowledgeStatusReport, MarketingLearningPattern, MarketingRecommendation, MarketingSearchQuery } from "./types.js";
/**
 * Marketing Knowledge Engine — understands, organizes and improves marketing knowledge.
 */
export declare class AiMarketingKnowledgeEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: MarketingKnowledgeLogger;
    readonly patterns: MarketingPatternStore;
    readonly records: MarketingRecordStore;
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
    analyzeCampaign(input: MarketingAnalysisInput): Promise<MarketingAnalysisResult>;
    getCampaign(campaignId: string): MarketingAnalysisRecord | null;
    searchCampaigns(query: MarketingSearchQuery): Promise<MarketingAnalysisRecord[]>;
    getRecommendations(campaignId: string): MarketingRecommendation[];
    detectRelationships(campaignId: string): import("./types.js").MarketingRelationships | null;
    getLearnedPatterns(): MarketingLearningPattern[];
    buildStatusReport(): MarketingKnowledgeStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=marketing-knowledge-engine.d.ts.map
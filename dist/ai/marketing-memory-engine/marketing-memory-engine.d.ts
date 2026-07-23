import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MarketingCustomerStore } from "./marketing-customer-store.js";
import { MarketingHistoryStore } from "./marketing-history-store.js";
import { MarketingMemoryLogger } from "./marketing-logger.js";
import { MarketingPatternStore } from "./marketing-pattern-store.js";
import { CustomerMemoryProfile, MarketingCreateInput, MarketingLearningResult, MarketingMemoryStatusReport, MarketingPattern, MarketingProcessResult, MarketingRecord, MarketingRelationships, MarketingUpdateInput } from "./types.js";
/**
 * Marketing Memory Engine — permanent marketing knowledge storage and learning.
 */
export declare class AiMarketingMemoryEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: MarketingMemoryLogger;
    readonly history: MarketingHistoryStore;
    readonly patterns: MarketingPatternStore;
    readonly customers: MarketingCustomerStore;
    private readonly campaigns;
    private readonly scorer;
    private linker;
    private patternDetector;
    private learner;
    private processor;
    private saveTimes;
    private loadTimes;
    private searchTimes;
    initialize(foundation: AiMemoryFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    createCampaign(input: MarketingCreateInput): Promise<MarketingProcessResult>;
    updateCampaign(campaignId: string, input: MarketingUpdateInput): Promise<MarketingProcessResult>;
    completeCampaign(campaignId: string, effectivenessRating?: number): Promise<MarketingLearningResult>;
    getCampaign(campaignId: string): Promise<MarketingRecord | null>;
    listCampaigns(): Promise<MarketingRecord[]>;
    getCustomerMemory(): CustomerMemoryProfile;
    learnCustomerInsights(partial: Partial<CustomerMemoryProfile>): CustomerMemoryProfile;
    getCampaignRelationships(campaignId: string): MarketingRelationships | null;
    getDetectedPatterns(): MarketingPattern[];
    getReusablePatterns(): MarketingPattern[];
    searchCampaigns(query: {
        name?: string;
        brand?: string;
        product?: string;
        platform?: string;
        style?: string;
        language?: string;
        targetAudience?: string;
        cta?: string;
        hook?: string;
        keywords?: string[];
        goal?: string;
        tags?: string[];
    }): MarketingRecord[];
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    buildStatusReport(): MarketingMemoryStatusReport;
    private ensureReady;
}
//# sourceMappingURL=marketing-memory-engine.d.ts.map
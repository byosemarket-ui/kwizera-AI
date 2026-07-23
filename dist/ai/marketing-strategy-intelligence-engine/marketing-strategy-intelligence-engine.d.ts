import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { MarketingStrategyLogger } from "./marketing-strategy-logger.js";
import { MarketingStrategyRecordStore } from "./marketing-strategy-stores.js";
import { MarketingObjective, MarketingStrategyEngineStatusReport, MarketingStrategyInput, MarketingStrategyRecord, MarketingStrategyResult, MarketingStrategySearchQuery } from "./types.js";
/**
 * Marketing Strategy Intelligence Engine — analyzes products, audiences, and business goals
 * to prepare marketing strategy before creative assets are generated.
 */
export declare class AiMarketingStrategyIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: MarketingStrategyLogger;
    readonly records: MarketingStrategyRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private strategyTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    prepareMarketingStrategy(input: MarketingStrategyInput): Promise<MarketingStrategyResult>;
    getStrategy(strategyId: string): MarketingStrategyRecord | null;
    getStrategiesByProduct(productId: string): MarketingStrategyRecord[];
    searchStrategies(query: MarketingStrategySearchQuery): MarketingStrategyRecord[];
    detectRelationships(strategyId: string): MarketingStrategyRecord["relationships"] | null;
    repairStrategy(productId: string, objective?: MarketingObjective): Promise<MarketingStrategyResult | null>;
    buildStatusReport(): MarketingStrategyEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=marketing-strategy-intelligence-engine.d.ts.map
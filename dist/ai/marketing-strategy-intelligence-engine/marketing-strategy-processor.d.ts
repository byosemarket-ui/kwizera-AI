import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { MarketingStrategyAnalyzer } from "./marketing-strategy-analyzer.js";
import { MarketingStrategyLinker } from "./marketing-strategy-linker.js";
import { MarketingStrategyLogger } from "./marketing-strategy-logger.js";
import { MarketingStrategyScorer } from "./marketing-strategy-scorer.js";
import { MarketingStrategyRecordStore } from "./marketing-strategy-stores.js";
import { MarketingStrategyInput, MarketingStrategyRecord, MarketingStrategyResult, MarketingStrategySearchQuery } from "./types.js";
export declare class MarketingStrategyProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, analyzer: MarketingStrategyAnalyzer, scorer: MarketingStrategyScorer, linker: MarketingStrategyLinker, records: MarketingStrategyRecordStore, logger: MarketingStrategyLogger);
    strategize(input: MarketingStrategyInput): Promise<MarketingStrategyResult>;
    search(query: MarketingStrategySearchQuery): MarketingStrategyRecord[];
    private businessGoalPrefix;
}
//# sourceMappingURL=marketing-strategy-processor.d.ts.map
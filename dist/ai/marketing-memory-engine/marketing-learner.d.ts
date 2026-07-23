import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MarketingMemoryLogger } from "./marketing-logger.js";
import { MarketingLearningResult, MarketingRecord } from "./types.js";
export declare class MarketingLearner {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, logger: MarketingMemoryLogger);
    learnFromCompletedCampaign(campaign: MarketingRecord, patternsStored: number): Promise<MarketingLearningResult>;
    private identifyStrengths;
    private identifyWeaknesses;
    private buildRecommendations;
    private buildDescription;
}
//# sourceMappingURL=marketing-learner.d.ts.map
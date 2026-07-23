import type { MemoryRecord } from "../memory-storage-engine/types.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MarketingCustomerStore } from "./marketing-customer-store.js";
import { MarketingHistoryStore } from "./marketing-history-store.js";
import { MarketingLearner } from "./marketing-learner.js";
import { MarketingMemoryLogger } from "./marketing-logger.js";
import { MarketingPatternDetector } from "./marketing-pattern-detector.js";
import { MarketingRelationshipLinker } from "./marketing-relationship-linker.js";
import { MarketingScorer } from "./marketing-scorer.js";
import { MarketingCreateInput, MarketingLearningResult, MarketingProcessResult, MarketingRecord, MarketingUpdateInput } from "./types.js";
export declare function recordFromMemory(record: MemoryRecord): MarketingRecord;
export declare class MarketingProcessor {
    private readonly foundation;
    private readonly history;
    private readonly customerStore;
    private readonly scorer;
    private readonly patternDetector;
    private readonly linker;
    private readonly learner;
    private readonly logger;
    private readonly campaigns;
    constructor(foundation: AiMemoryFoundation, history: MarketingHistoryStore, customerStore: MarketingCustomerStore, scorer: MarketingScorer, patternDetector: MarketingPatternDetector, linker: MarketingRelationshipLinker, learner: MarketingLearner, logger: MarketingMemoryLogger, campaigns: Map<string, MarketingRecord>);
    create(input: MarketingCreateInput): Promise<MarketingProcessResult>;
    update(campaignId: string, input: MarketingUpdateInput): Promise<MarketingProcessResult>;
    complete(campaignId: string, effectivenessRating?: number): Promise<MarketingLearningResult>;
    loadCampaign(campaignId: string): Promise<MarketingRecord | null>;
    private mergeContent;
    private appendContent;
    private toMemoryInput;
    private toPayload;
    private summarizeChanges;
    private fail;
}
//# sourceMappingURL=marketing-processor.d.ts.map
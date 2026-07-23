import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { AudienceIntelligenceRecord } from "../audience-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { MarketingStrategyRecord, MarketingStrategyRelationships } from "./types.js";
export declare class MarketingStrategyLinker {
    detectRelationships(record: MarketingStrategyRecord, allRecords: MarketingStrategyRecord[], understanding: ProductUnderstandingRecord, analysis: ProductAnalysisIntelligenceRecord, audienceIntelligence?: AudienceIntelligenceRecord, campaignId?: string): MarketingStrategyRelationships;
    private extractBusinessGoalLabels;
}
//# sourceMappingURL=marketing-strategy-linker.d.ts.map
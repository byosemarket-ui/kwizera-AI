import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { AudienceIntelligenceRecord } from "../audience-intelligence-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { CreativeDirectionRecord, CreativeRelationships } from "./types.js";
export declare class CreativeDirectionLinker {
    detectRelationships(record: CreativeDirectionRecord, allRecords: CreativeDirectionRecord[], understanding: ProductUnderstandingRecord, analysis: ProductAnalysisIntelligenceRecord, strategy: MarketingStrategyRecord, audience: AudienceIntelligenceRecord): CreativeRelationships;
}
//# sourceMappingURL=creative-direction-linker.d.ts.map
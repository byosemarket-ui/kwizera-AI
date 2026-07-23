import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { AudienceIntelligenceRecord, AudienceRelationships } from "./types.js";
export declare class AudienceLinker {
    detectRelationships(record: AudienceIntelligenceRecord, allRecords: AudienceIntelligenceRecord[], understanding: ProductUnderstandingRecord, analysis: ProductAnalysisIntelligenceRecord, campaignId?: string): AudienceRelationships;
}
//# sourceMappingURL=audience-linker.d.ts.map
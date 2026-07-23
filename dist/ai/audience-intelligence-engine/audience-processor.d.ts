import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { AudienceAnalyzer } from "./audience-analyzer.js";
import { AudienceLinker } from "./audience-linker.js";
import { AudienceLogger } from "./audience-logger.js";
import { AudienceScorer } from "./audience-scorer.js";
import { AudienceRecordStore } from "./audience-stores.js";
import { AudienceIntelligenceInput, AudienceIntelligenceRecord, AudienceIntelligenceResult, AudienceSearchQuery } from "./types.js";
export declare class AudienceProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, analyzer: AudienceAnalyzer, scorer: AudienceScorer, linker: AudienceLinker, records: AudienceRecordStore, logger: AudienceLogger);
    analyze(input: AudienceIntelligenceInput): Promise<AudienceIntelligenceResult>;
    search(query: AudienceSearchQuery): AudienceIntelligenceRecord[];
}
//# sourceMappingURL=audience-processor.d.ts.map
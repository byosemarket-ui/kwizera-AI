import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { CreativeDirectionAnalyzer } from "./creative-direction-analyzer.js";
import { CreativeDirectionLinker } from "./creative-direction-linker.js";
import { CreativeDirectionLogger } from "./creative-direction-logger.js";
import { CreativeDirectionScorer } from "./creative-direction-scorer.js";
import { CreativeDirectionRecordStore } from "./creative-direction-stores.js";
import { CreativeDirectionInput, CreativeDirectionRecord, CreativeDirectionResult, CreativeDirectionSearchQuery } from "./types.js";
export declare class CreativeDirectionProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, analyzer: CreativeDirectionAnalyzer, scorer: CreativeDirectionScorer, linker: CreativeDirectionLinker, records: CreativeDirectionRecordStore, logger: CreativeDirectionLogger);
    plan(input: CreativeDirectionInput): Promise<CreativeDirectionResult>;
    search(query: CreativeDirectionSearchQuery): CreativeDirectionRecord[];
    private reject;
}
//# sourceMappingURL=creative-direction-processor.d.ts.map
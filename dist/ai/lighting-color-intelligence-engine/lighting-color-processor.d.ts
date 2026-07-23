import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { LightingColorAnalyzer } from "./lighting-color-analyzer.js";
import { LightingColorLinker } from "./lighting-color-linker.js";
import { LightingColorLogger } from "./lighting-color-logger.js";
import { LightingColorScorer } from "./lighting-color-scorer.js";
import { LightingColorIntelligenceRecordStore } from "./lighting-color-stores.js";
import { LightingColorIntelligenceInput, LightingColorIntelligenceRecord, LightingColorIntelligenceResult, LightingColorIntelligenceSearchQuery } from "./types.js";
export declare class LightingColorProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, analyzer: LightingColorAnalyzer, scorer: LightingColorScorer, linker: LightingColorLinker, records: LightingColorIntelligenceRecordStore, logger: LightingColorLogger);
    analyze(input: LightingColorIntelligenceInput): Promise<LightingColorIntelligenceResult>;
    search(query: LightingColorIntelligenceSearchQuery): LightingColorIntelligenceRecord[];
}
//# sourceMappingURL=lighting-color-processor.d.ts.map
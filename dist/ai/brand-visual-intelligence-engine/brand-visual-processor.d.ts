import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { BrandVisualAnalyzer } from "./brand-visual-analyzer.js";
import { BrandVisualLinker } from "./brand-visual-linker.js";
import { BrandVisualLogger } from "./brand-visual-logger.js";
import { BrandVisualScorer } from "./brand-visual-scorer.js";
import { BrandVisualIntelligenceRecordStore } from "./brand-visual-stores.js";
import { BrandVisualIntelligenceInput, BrandVisualIntelligenceRecord, BrandVisualIntelligenceResult, BrandVisualIntelligenceSearchQuery } from "./types.js";
export declare class BrandVisualProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, analyzer: BrandVisualAnalyzer, scorer: BrandVisualScorer, linker: BrandVisualLinker, records: BrandVisualIntelligenceRecordStore, logger: BrandVisualLogger);
    analyze(input: BrandVisualIntelligenceInput): Promise<BrandVisualIntelligenceResult>;
    search(query: BrandVisualIntelligenceSearchQuery): BrandVisualIntelligenceRecord[];
}
//# sourceMappingURL=brand-visual-processor.d.ts.map
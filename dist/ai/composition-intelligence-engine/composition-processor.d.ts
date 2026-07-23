import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { CompositionAnalyzer } from "./composition-analyzer.js";
import { CompositionLinker } from "./composition-linker.js";
import { CompositionLogger } from "./composition-logger.js";
import { CompositionScorer } from "./composition-scorer.js";
import { CompositionIntelligenceRecordStore } from "./composition-stores.js";
import { CompositionIntelligenceInput, CompositionIntelligenceRecord, CompositionIntelligenceResult, CompositionIntelligenceSearchQuery } from "./types.js";
export declare class CompositionProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, analyzer: CompositionAnalyzer, scorer: CompositionScorer, linker: CompositionLinker, records: CompositionIntelligenceRecordStore, logger: CompositionLogger);
    analyze(input: CompositionIntelligenceInput): Promise<CompositionIntelligenceResult>;
    search(query: CompositionIntelligenceSearchQuery): CompositionIntelligenceRecord[];
}
//# sourceMappingURL=composition-processor.d.ts.map
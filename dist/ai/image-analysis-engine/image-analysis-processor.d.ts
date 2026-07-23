import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageAnalysisAnalyzer } from "./image-analysis-analyzer.js";
import { ImageAnalysisCompletenessDetector } from "./image-analysis-completeness.js";
import { ImageAnalysisLinker } from "./image-analysis-linker.js";
import { ImageAnalysisLogger } from "./image-analysis-logger.js";
import { ImageAnalysisScorer } from "./image-analysis-scorer.js";
import { ImageAnalysisRecordStore } from "./image-analysis-stores.js";
import { ImageAnalysisEngineInput, ImageAnalysisEngineResult, ImageAnalysisIntelligenceRecord, ImageAnalysisSearchQuery } from "./types.js";
export declare class ImageAnalysisProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly completeness;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, analyzer: ImageAnalysisAnalyzer, completeness: ImageAnalysisCompletenessDetector, scorer: ImageAnalysisScorer, linker: ImageAnalysisLinker, records: ImageAnalysisRecordStore, logger: ImageAnalysisLogger);
    analyze(input: ImageAnalysisEngineInput): Promise<ImageAnalysisEngineResult>;
    search(query: ImageAnalysisSearchQuery): ImageAnalysisIntelligenceRecord[];
}
//# sourceMappingURL=image-analysis-processor.d.ts.map
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageIntelligenceOptimizationAnalyzer } from "./image-intelligence-optimization-analyzer.js";
import { ImageIntelligenceOptimizationLinker } from "./image-intelligence-optimization-linker.js";
import { ImageIntelligenceOptimizationLogger } from "./image-intelligence-optimization-logger.js";
import { ImageIntelligenceOptimizationScorer } from "./image-intelligence-optimization-scorer.js";
import { ImageIntelligenceOptimizationRecordStore } from "./image-intelligence-optimization-stores.js";
import { ImageIntelligenceOptimizationInput, ImageIntelligenceOptimizationRecord, ImageIntelligenceOptimizationResult, ImageIntelligenceOptimizationSearchQuery } from "./types.js";
export declare class ImageIntelligenceOptimizationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, analyzer: ImageIntelligenceOptimizationAnalyzer, scorer: ImageIntelligenceOptimizationScorer, linker: ImageIntelligenceOptimizationLinker, records: ImageIntelligenceOptimizationRecordStore, logger: ImageIntelligenceOptimizationLogger);
    runOptimization(input: ImageIntelligenceOptimizationInput): Promise<ImageIntelligenceOptimizationResult>;
    search(query: ImageIntelligenceOptimizationSearchQuery): ImageIntelligenceOptimizationRecord[];
    restoreRecoveryPoint(recoveryId: string): boolean;
    private reject;
}
//# sourceMappingURL=image-intelligence-optimization-processor.d.ts.map
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageQualityPredictionAnalyzer } from "./image-quality-prediction-analyzer.js";
import { ImageQualityPredictionLinker } from "./image-quality-prediction-linker.js";
import { ImageQualityPredictionLogger } from "./image-quality-prediction-logger.js";
import { ImageQualityPredictionScorer } from "./image-quality-prediction-scorer.js";
import { ImageQualityPredictionRecordStore } from "./image-quality-prediction-stores.js";
import { ImageQualityPredictionInput, ImageQualityPredictionRecord, ImageQualityPredictionResult, ImageQualityPredictionSearchQuery } from "./types.js";
export declare class ImageQualityPredictionProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, analyzer: ImageQualityPredictionAnalyzer, scorer: ImageQualityPredictionScorer, linker: ImageQualityPredictionLinker, records: ImageQualityPredictionRecordStore, logger: ImageQualityPredictionLogger);
    predict(input: ImageQualityPredictionInput): Promise<ImageQualityPredictionResult>;
    search(query: ImageQualityPredictionSearchQuery): ImageQualityPredictionRecord[];
    private fail;
}
//# sourceMappingURL=image-quality-prediction-processor.d.ts.map
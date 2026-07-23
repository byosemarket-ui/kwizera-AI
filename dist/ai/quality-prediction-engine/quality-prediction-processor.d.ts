import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { QualityPredictionAnalyzer } from "./quality-prediction-analyzer.js";
import { QualityPredictionLinker } from "./quality-prediction-linker.js";
import { QualityPredictionLogger } from "./quality-prediction-logger.js";
import { QualityPredictionScorer } from "./quality-prediction-scorer.js";
import { QualityPredictionRecordStore } from "./quality-prediction-stores.js";
import { QualityPredictionInput, QualityPredictionRecord, QualityPredictionResult, QualityPredictionSearchQuery } from "./types.js";
export declare class QualityPredictionProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, analyzer: QualityPredictionAnalyzer, scorer: QualityPredictionScorer, linker: QualityPredictionLinker, records: QualityPredictionRecordStore, logger: QualityPredictionLogger);
    predictQuality(input: QualityPredictionInput): Promise<QualityPredictionResult>;
    search(query: QualityPredictionSearchQuery): QualityPredictionRecord[];
    private reject;
}
//# sourceMappingURL=quality-prediction-processor.d.ts.map
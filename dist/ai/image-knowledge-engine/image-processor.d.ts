import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { ImageAnalyzer } from "./image-analyzer.js";
import { ImageLearner } from "./image-learner.js";
import { ImageKnowledgeLogger } from "./image-logger.js";
import { ImageRelationshipLinker, ImageRecommender } from "./image-recommender.js";
import { ImageScorer } from "./image-scorer.js";
import { ImageRecordStore } from "./image-stores.js";
import { ImageAnalysisInput, ImageAnalysisRecord, ImageAnalysisResult, ImageSearchQuery } from "./types.js";
export declare class ImageProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly recommender;
    private readonly linker;
    private readonly learner;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, analyzer: ImageAnalyzer, scorer: ImageScorer, recommender: ImageRecommender, linker: ImageRelationshipLinker, learner: ImageLearner, records: ImageRecordStore, logger: ImageKnowledgeLogger);
    analyze(input: ImageAnalysisInput): Promise<ImageAnalysisResult>;
    search(query: ImageSearchQuery): Promise<ImageAnalysisRecord[]>;
    private filterLocal;
    private ensureGraphNode;
    private buildKnowledgeDescription;
}
//# sourceMappingURL=image-processor.d.ts.map
import { ImageAnalysisRecord, ImageLearningPattern } from "./types.js";
import { ImagePatternStore } from "./image-stores.js";
import { ImageKnowledgeLogger } from "./image-logger.js";
export declare class ImageLearner {
    private readonly patterns;
    private readonly logger;
    constructor(patterns: ImagePatternStore, logger: ImageKnowledgeLogger);
    learnFromAnalysis(record: ImageAnalysisRecord): ImageLearningPattern[];
    private createPattern;
}
//# sourceMappingURL=image-learner.d.ts.map
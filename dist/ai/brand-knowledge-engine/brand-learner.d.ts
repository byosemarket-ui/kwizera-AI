import { BrandAnalysisRecord, BrandKnowledgeLearningPattern } from "./types.js";
import { BrandPatternStore } from "./brand-stores.js";
import { BrandKnowledgeLogger } from "./brand-logger.js";
export declare class BrandLearner {
    private readonly patterns;
    private readonly logger;
    constructor(patterns: BrandPatternStore, logger: BrandKnowledgeLogger);
    learnFromAnalysis(record: BrandAnalysisRecord): BrandKnowledgeLearningPattern[];
    private createPattern;
}
//# sourceMappingURL=brand-learner.d.ts.map
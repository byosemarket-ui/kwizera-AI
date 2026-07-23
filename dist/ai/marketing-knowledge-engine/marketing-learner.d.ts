import { MarketingAnalysisRecord, MarketingLearningPattern } from "./types.js";
import { MarketingPatternStore } from "./marketing-stores.js";
import { MarketingKnowledgeLogger } from "./marketing-logger.js";
export declare class MarketingLearner {
    private readonly patterns;
    private readonly logger;
    constructor(patterns: MarketingPatternStore, logger: MarketingKnowledgeLogger);
    learnFromAnalysis(record: MarketingAnalysisRecord): MarketingLearningPattern[];
    private createPattern;
}
//# sourceMappingURL=marketing-learner.d.ts.map
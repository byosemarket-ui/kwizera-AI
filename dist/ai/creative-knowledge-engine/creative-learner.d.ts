import { CreativeAnalysisRecord, CreativeKnowledgeLearningPattern } from "./types.js";
import { CreativePatternStore } from "./creative-stores.js";
import { CreativeKnowledgeLogger } from "./creative-logger.js";
export declare class CreativeLearner {
    private readonly patterns;
    private readonly logger;
    constructor(patterns: CreativePatternStore, logger: CreativeKnowledgeLogger);
    learnFromAnalysis(record: CreativeAnalysisRecord): CreativeKnowledgeLearningPattern[];
    private createPattern;
}
//# sourceMappingURL=creative-learner.d.ts.map
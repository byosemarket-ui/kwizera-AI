import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { LearningEvaluator } from "./learning-evaluator.js";
import { LearningHistoryStore } from "./learning-history-store.js";
import { LearningMemoryLogger } from "./learning-logger.js";
import { PatternDetector } from "./pattern-detector.js";
import { LearningEventInput, LearningProcessResult } from "./types.js";
export declare class LearningProcessor {
    private readonly foundation;
    private readonly evaluator;
    private readonly history;
    private readonly patterns;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, evaluator: LearningEvaluator, history: LearningHistoryStore, patterns: PatternDetector, logger: LearningMemoryLogger);
    process(input: LearningEventInput): Promise<LearningProcessResult>;
    private collectInformation;
    private refineInformation;
    private reject;
}
//# sourceMappingURL=learning-processor.d.ts.map
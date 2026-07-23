import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { AnimationGenerationAnalyzer } from "./animation-generation-analyzer.js";
import { AnimationGenerationLinker } from "./animation-generation-linker.js";
import { AnimationGenerationLogger } from "./animation-generation-logger.js";
import { AnimationGenerationScorer } from "./animation-generation-scorer.js";
import { AnimationGenerationRecordStore } from "./animation-generation-stores.js";
import { AnimationGenerationInput, AnimationGenerationRecord, AnimationGenerationResult, AnimationGenerationSearchQuery } from "./types.js";
export declare class AnimationGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, analyzer: AnimationGenerationAnalyzer, scorer: AnimationGenerationScorer, linker: AnimationGenerationLinker, records: AnimationGenerationRecordStore, logger: AnimationGenerationLogger);
    generateAnimationPlans(input: AnimationGenerationInput): Promise<AnimationGenerationResult>;
    search(query: AnimationGenerationSearchQuery): AnimationGenerationRecord[];
    private resolveBundles;
    private registerGenerationAsset;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=animation-generation-processor.d.ts.map
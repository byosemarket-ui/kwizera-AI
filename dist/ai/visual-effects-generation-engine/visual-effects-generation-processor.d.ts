import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VisualEffectsGenerationAnalyzer } from "./visual-effects-generation-analyzer.js";
import { VisualEffectsGenerationLinker } from "./visual-effects-generation-linker.js";
import { VisualEffectsGenerationLogger } from "./visual-effects-generation-logger.js";
import { VisualEffectsGenerationScorer } from "./visual-effects-generation-scorer.js";
import { VisualEffectsGenerationRecordStore } from "./visual-effects-generation-stores.js";
import { VisualEffectsGenerationInput, VisualEffectsGenerationRecord, VisualEffectsGenerationResult, VisualEffectsGenerationSearchQuery } from "./types.js";
export declare class VisualEffectsGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, analyzer: VisualEffectsGenerationAnalyzer, scorer: VisualEffectsGenerationScorer, linker: VisualEffectsGenerationLinker, records: VisualEffectsGenerationRecordStore, logger: VisualEffectsGenerationLogger);
    generateVisualEffectPlans(input: VisualEffectsGenerationInput): Promise<VisualEffectsGenerationResult>;
    search(query: VisualEffectsGenerationSearchQuery): VisualEffectsGenerationRecord[];
    private resolveBundles;
    private registerGenerationAsset;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=visual-effects-generation-processor.d.ts.map
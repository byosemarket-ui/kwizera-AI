import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { RenderingPreparationAnalyzer } from "./rendering-preparation-analyzer.js";
import { RenderingPreparationLinker } from "./rendering-preparation-linker.js";
import { RenderingPreparationLogger } from "./rendering-preparation-logger.js";
import { RenderingPreparationScorer } from "./rendering-preparation-scorer.js";
import { RenderingPreparationRecordStore } from "./rendering-preparation-stores.js";
import { RenderingPreparationInput, RenderingPreparationRecord, RenderingPreparationResult, RenderingPreparationSearchQuery } from "./types.js";
export declare class RenderingPreparationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, analyzer: RenderingPreparationAnalyzer, scorer: RenderingPreparationScorer, linker: RenderingPreparationLinker, records: RenderingPreparationRecordStore, logger: RenderingPreparationLogger);
    prepareRenderPlans(input: RenderingPreparationInput): Promise<RenderingPreparationResult>;
    search(query: RenderingPreparationSearchQuery): RenderingPreparationRecord[];
    private resolveBundles;
    private registerGenerationAsset;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=rendering-preparation-processor.d.ts.map
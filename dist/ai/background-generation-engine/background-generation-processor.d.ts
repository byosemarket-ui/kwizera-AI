import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { BackgroundGenerationAnalyzer } from "./background-generation-analyzer.js";
import { BackgroundGenerationLinker } from "./background-generation-linker.js";
import { BackgroundGenerationLogger } from "./background-generation-logger.js";
import { BackgroundGenerationScorer } from "./background-generation-scorer.js";
import { BackgroundGenerationRecordStore } from "./background-generation-stores.js";
import { BackgroundGenerationInput, BackgroundGenerationRecord, BackgroundGenerationResult, BackgroundGenerationSearchQuery } from "./types.js";
export declare class BackgroundGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, analyzer: BackgroundGenerationAnalyzer, scorer: BackgroundGenerationScorer, linker: BackgroundGenerationLinker, records: BackgroundGenerationRecordStore, logger: BackgroundGenerationLogger);
    generateBackgroundPlan(input: BackgroundGenerationInput): Promise<BackgroundGenerationResult>;
    search(query: BackgroundGenerationSearchQuery): BackgroundGenerationRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=background-generation-processor.d.ts.map
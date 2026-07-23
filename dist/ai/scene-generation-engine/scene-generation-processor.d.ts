import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { SceneGenerationAnalyzer } from "./scene-generation-analyzer.js";
import { SceneGenerationLinker } from "./scene-generation-linker.js";
import { SceneGenerationLogger } from "./scene-generation-logger.js";
import { SceneGenerationScorer } from "./scene-generation-scorer.js";
import { SceneGenerationRecordStore } from "./scene-generation-stores.js";
import { SceneGenerationInput, SceneGenerationRecord, SceneGenerationResult, SceneGenerationSearchQuery } from "./types.js";
export declare class SceneGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, analyzer: SceneGenerationAnalyzer, scorer: SceneGenerationScorer, linker: SceneGenerationLinker, records: SceneGenerationRecordStore, logger: SceneGenerationLogger);
    generateScenes(input: SceneGenerationInput): Promise<SceneGenerationResult>;
    search(query: SceneGenerationSearchQuery): SceneGenerationRecord[];
    private resolveStoryboard;
    private registerGenerationAsset;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=scene-generation-processor.d.ts.map
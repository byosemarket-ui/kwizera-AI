import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { CameraDirectorAnalyzer } from "./camera-director-analyzer.js";
import { CameraDirectorLinker } from "./camera-director-linker.js";
import { CameraDirectorLogger } from "./camera-director-logger.js";
import { CameraDirectorScorer } from "./camera-director-scorer.js";
import { CameraDirectorRecordStore } from "./camera-director-stores.js";
import { CameraDirectorInput, CameraDirectorRecord, CameraDirectorResult, CameraDirectorSearchQuery } from "./types.js";
export declare class CameraDirectorProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, analyzer: CameraDirectorAnalyzer, scorer: CameraDirectorScorer, linker: CameraDirectorLinker, records: CameraDirectorRecordStore, logger: CameraDirectorLogger);
    planCamera(input: CameraDirectorInput): Promise<CameraDirectorResult>;
    search(query: CameraDirectorSearchQuery): CameraDirectorRecord[];
    private resolveScenes;
    private registerGenerationAsset;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=camera-director-processor.d.ts.map
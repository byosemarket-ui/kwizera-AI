import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { CreativeVideoAnalyzer } from "./creative-video-analyzer.js";
import { CreativeVideoLinker } from "./creative-video-linker.js";
import { CreativeVideoLogger } from "./creative-video-logger.js";
import { CreativeVideoScorer } from "./creative-video-scorer.js";
import { CreativeVideoRecordStore } from "./creative-video-stores.js";
import { CreativeVideoIntelligenceInput, CreativeVideoIntelligenceRecord, CreativeVideoIntelligenceResult, CreativeVideoSearchQuery, CreativeVideoPlatform, CreativeVideoType, CreativeVideoTemplateType } from "./types.js";
export declare class CreativeVideoProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoIntelligenceFoundation, analyzer: CreativeVideoAnalyzer, scorer: CreativeVideoScorer, linker: CreativeVideoLinker, records: CreativeVideoRecordStore, logger: CreativeVideoLogger);
    planCreative(input: CreativeVideoIntelligenceInput): Promise<CreativeVideoIntelligenceResult>;
    search(query: CreativeVideoSearchQuery): CreativeVideoIntelligenceRecord[];
    private reject;
}
export { CreativeVideoPlatform, CreativeVideoType, CreativeVideoTemplateType };
//# sourceMappingURL=creative-video-processor.d.ts.map
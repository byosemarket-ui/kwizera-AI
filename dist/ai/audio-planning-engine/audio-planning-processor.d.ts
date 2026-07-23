import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { AudioPlanningAnalyzer } from "./audio-planning-analyzer.js";
import { AudioPlanningLinker } from "./audio-planning-linker.js";
import { AudioPlanningLogger } from "./audio-planning-logger.js";
import { AudioPlanningScorer } from "./audio-planning-scorer.js";
import { AudioPlanningRecordStore } from "./audio-planning-stores.js";
import { AudioPlanningInput, AudioPlanningRecord, AudioPlanningResult, AudioPlanningSearchQuery } from "./types.js";
export declare class AudioPlanningProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, analyzer: AudioPlanningAnalyzer, scorer: AudioPlanningScorer, linker: AudioPlanningLinker, records: AudioPlanningRecordStore, logger: AudioPlanningLogger);
    createAudioPlan(input: AudioPlanningInput): Promise<AudioPlanningResult>;
    search(query: AudioPlanningSearchQuery): AudioPlanningRecord[];
    private applySceneRepairs;
    private applyScoreRepairs;
    private reject;
}
//# sourceMappingURL=audio-planning-processor.d.ts.map
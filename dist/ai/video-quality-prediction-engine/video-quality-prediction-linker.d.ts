import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import type { VideoEnhancementPlanRecord } from "../video-enhancement-planning-engine/types.js";
import type { CreativeVideoIntelligenceRecord } from "../creative-video-intelligence-engine/types.js";
import type { ProductionVideoPlanningRecord } from "../production-video-planning-engine/types.js";
import { VideoQualityPredictionRecord, VideoQualityPredictionRelationships } from "./types.js";
export declare class VideoQualityPredictionLinker {
    detectRelationships(record: VideoQualityPredictionRecord, allRecords: VideoQualityPredictionRecord[], analysis: VideoAnalysisIntelligenceRecord, understanding: VideoUnderstandingRecord, productionPlan: ProductionVideoPlanningRecord, creativePlan: CreativeVideoIntelligenceRecord, enhancementPlan: VideoEnhancementPlanRecord, projects?: string[], knowledgeIds?: string[], scriptIds?: string[]): VideoQualityPredictionRelationships;
}
//# sourceMappingURL=video-quality-prediction-linker.d.ts.map
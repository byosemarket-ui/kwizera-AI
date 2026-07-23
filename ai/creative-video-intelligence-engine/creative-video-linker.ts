import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { VideoEnhancementPlanRecord } from "../video-enhancement-planning-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoStyleIntelligenceRecord } from "../video-style-intelligence-engine/types.js";
import { CreativeRelationships, CreativeVideoIntelligenceRecord } from "./types.js";

export class CreativeVideoLinker {
  detectRelationships(
    record: CreativeVideoIntelligenceRecord,
    allRecords: CreativeVideoIntelligenceRecord[],
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    motion: MotionIntelligenceRecord | null | undefined,
    camera: CameraMovementRecord | null | undefined,
    enhancement: VideoEnhancementPlanRecord | null | undefined,
    style: VideoStyleIntelligenceRecord | null | undefined,
    projects: string[] = [],
    knowledgeIds: string[] = [],
    storyboards: string[] = [],
    scripts: string[] = []
  ): CreativeRelationships {
    const relatedVideos: string[] = [];
    for (const other of allRecords) {
      if (other.videoId === record.videoId) continue;
      if (other.creativeType === record.creativeType) relatedVideos.push(other.videoId);
    }

    return {
      relatedStoryboards: [
        ...new Set([
          ...storyboards,
          record.profile.creativeVideoId,
          ...record.storyboard.sceneOrder,
        ]),
      ],
      relatedProducts: [...new Set(analysis.relationships.relatedProducts)],
      relatedBrands: [...new Set(analysis.relationships.relatedBrands)],
      relatedCampaigns: [...new Set(analysis.relationships.relatedCampaigns)],
      relatedMotionPlans: motion ? [motion.intelligenceId, motion.motionPlan.motionPath] : [],
      relatedCameraPlans: camera
        ? [camera.intelligenceId, camera.movementPlan.recommendedPath]
        : [],
      relatedEnhancementPlans: enhancement
        ? [enhancement.intelligenceId, enhancement.profile.enhancementPlanId]
        : [],
      relatedScripts: [...new Set(scripts)],
      relatedKnowledge: [
        ...new Set([
          ...knowledgeIds,
          ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
          ...analysis.relationships.relatedKnowledge,
        ]),
      ],
      relatedVideos: [...new Set([...relatedVideos, ...analysis.relationships.relatedVideos])].slice(0, 10),
      relatedMemory: [...new Set(analysis.relationships.relatedMemory)],
      relatedProjects: [...new Set([...projects, ...analysis.relationships.relatedProjects])],
    };
  }
}

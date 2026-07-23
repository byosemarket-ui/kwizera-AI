import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoStyleIntelligenceRecord } from "../video-style-intelligence-engine/types.js";
import { EnhancementRelationships, VideoEnhancementPlanRecord } from "./types.js";

export class VideoEnhancementLinker {
  detectRelationships(
    record: VideoEnhancementPlanRecord,
    allRecords: VideoEnhancementPlanRecord[],
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    timeline: TimelineIntelligenceRecord | null | undefined,
    camera: CameraMovementRecord | null | undefined,
    motion: MotionIntelligenceRecord | null | undefined,
    style: VideoStyleIntelligenceRecord | null | undefined,
    projects: string[] = [],
    knowledgeIds: string[] = []
  ): EnhancementRelationships {
    const relatedVideos: string[] = [];
    for (const other of allRecords) {
      if (other.videoId === record.videoId) continue;
      if (other.profile.platform === record.profile.platform) relatedVideos.push(other.videoId);
    }

    return {
      relatedVideos: [...new Set([...relatedVideos, ...analysis.relationships.relatedVideos])].slice(0, 10),
      relatedScenes: sceneDetection.scenes.map((s) => s.sceneId),
      relatedTimelines: timeline
        ? [timeline.timelineId, ...timeline.variants.map((v) => v.timelineId)]
        : [],
      relatedMotionPlans: motion ? [motion.intelligenceId, motion.motionPlan.motionPath] : [],
      relatedCameraPlans: camera
        ? [camera.intelligenceId, camera.movementPlan.recommendedPath]
        : [],
      relatedStylePlans: style ? [style.intelligenceId, style.profile.styleId] : [],
      relatedProducts: [...new Set(analysis.relationships.relatedProducts)],
      relatedBrands: [...new Set(analysis.relationships.relatedBrands)],
      relatedCampaigns: [...new Set(analysis.relationships.relatedCampaigns)],
      relatedKnowledge: [
        ...new Set([
          ...knowledgeIds,
          ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
          ...analysis.relationships.relatedKnowledge,
        ]),
      ],
      relatedMemory: [...new Set(analysis.relationships.relatedMemory)],
      relatedProjects: [...new Set([...projects, ...analysis.relationships.relatedProjects])],
    };
  }
}

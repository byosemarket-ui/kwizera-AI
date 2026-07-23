import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { MotionIntelligenceRecord, MotionRelationships } from "./types.js";

export class MotionIntelligenceLinker {
  detectRelationships(
    record: MotionIntelligenceRecord,
    allRecords: MotionIntelligenceRecord[],
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    timeline: TimelineIntelligenceRecord | null | undefined,
    camera: CameraMovementRecord | null | undefined,
    projects: string[] = [],
    knowledgeIds: string[] = [],
    storyboards: string[] = []
  ): MotionRelationships {
    const relatedVideos: string[] = [];
    for (const other of allRecords) {
      if (other.videoId === record.videoId) continue;
      if (other.dominantClassification === record.dominantClassification) {
        relatedVideos.push(other.videoId);
      }
    }

    const cameraMovements: string[] = [];
    if (camera) {
      cameraMovements.push(camera.intelligenceId, ...camera.detectedMovements);
    }

    return {
      relatedScenes: sceneDetection.scenes.map((s) => s.sceneId),
      relatedShots: sceneDetection.shots.map((s) => s.shotId),
      relatedCameraMovements: cameraMovements,
      relatedTimelines: timeline
        ? [timeline.timelineId, ...timeline.variants.map((v) => v.timelineId)]
        : [],
      relatedStoryboards: [...new Set(storyboards)],
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
      relatedVideos: [...new Set([...relatedVideos, ...analysis.relationships.relatedVideos])].slice(0, 10),
      relatedMemory: [...new Set(analysis.relationships.relatedMemory)],
      relatedProjects: [...new Set([...projects, ...analysis.relationships.relatedProjects])],
    };
  }
}

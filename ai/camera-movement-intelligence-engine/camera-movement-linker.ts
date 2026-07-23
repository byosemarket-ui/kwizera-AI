import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import { CameraMovementRecord, CameraRelationships } from "./types.js";

export class CameraMovementLinker {
  detectRelationships(
    record: CameraMovementRecord,
    allRecords: CameraMovementRecord[],
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    timeline: TimelineIntelligenceRecord | null | undefined,
    projects: string[] = [],
    knowledgeIds: string[] = [],
    storyboards: string[] = [],
    scripts: string[] = []
  ): CameraRelationships {
    const relatedVideos: string[] = [];
    for (const other of allRecords) {
      if (other.videoId === record.videoId) continue;
      if (other.dominantMovement === record.dominantMovement) relatedVideos.push(other.videoId);
    }

    return {
      relatedScenes: sceneDetection.scenes.map((s) => s.sceneId),
      relatedShots: sceneDetection.shots.map((s) => s.shotId),
      relatedTimelines: timeline ? [timeline.timelineId, ...timeline.variants.map((v) => v.timelineId)] : [],
      relatedStoryboards: [...new Set(storyboards)],
      relatedScripts: [...new Set(scripts)],
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

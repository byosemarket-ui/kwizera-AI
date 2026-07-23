import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import { TimelineIntelligenceRecord, TimelineRelationships } from "./types.js";

export class TimelineIntelligenceLinker {
  detectRelationships(
    record: TimelineIntelligenceRecord,
    allRecords: TimelineIntelligenceRecord[],
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    projects: string[] = [],
    knowledgeIds: string[] = [],
    storyboards: string[] = [],
    scripts: string[] = [],
    audioPlans: string[] = [],
    productionPlans: string[] = []
  ): TimelineRelationships {
    const relatedVideos: string[] = [];

    for (const other of allRecords) {
      if (other.videoId === record.videoId) continue;
      const sharedBrand = other.relationships.relatedBrands.some((b) =>
        record.relationships.relatedBrands.includes(b)
      );
      if (sharedBrand) relatedVideos.push(other.videoId);
    }

    return {
      relatedVideos: [...new Set([...relatedVideos, ...analysis.relationships.relatedVideos])].slice(0, 10),
      relatedScenes: sceneDetection.scenes.map((s) => s.sceneId),
      relatedShots: sceneDetection.shots.map((s) => s.shotId),
      relatedProducts: [...new Set(analysis.relationships.relatedProducts)],
      relatedBrands: [...new Set(analysis.relationships.relatedBrands)],
      relatedCampaigns: [...new Set(analysis.relationships.relatedCampaigns)],
      relatedStoryboards: [...new Set(storyboards)],
      relatedScripts: [...new Set(scripts)],
      relatedAudioPlans: [...new Set(audioPlans)],
      relatedProductionPlans: [...new Set(productionPlans)],
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

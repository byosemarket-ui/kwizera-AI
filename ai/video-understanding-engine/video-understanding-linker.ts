import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { VideoUnderstandingRecord, VideoUnderstandingRelationships } from "./types.js";

export class VideoUnderstandingLinker {
  detectRelationships(
    record: VideoUnderstandingRecord,
    allRecords: VideoUnderstandingRecord[],
    analysis: VideoAnalysisIntelligenceRecord,
    projects: string[] = [],
    knowledgeIds: string[] = [],
    storyboards: string[] = [],
    scripts: string[] = [],
    creativePlans: string[] = []
  ): VideoUnderstandingRelationships {
    const relatedVideos: string[] = [];
    const relatedBrands = [
      record.brand.brandIdentity,
      ...analysis.relationships.relatedBrands,
    ].filter((b) => b && b !== "unknown-brand");
    const relatedProducts = [
      record.product.mainProduct,
      ...record.product.secondaryProducts,
      ...analysis.relationships.relatedProducts,
    ].filter((p) => p && p !== "none");

    for (const other of allRecords) {
      if (other.videoId === record.videoId) continue;

      if (other.brand.brandIdentity === record.brand.brandIdentity) {
        relatedVideos.push(other.videoId);
      } else if (other.story.storyType === record.story.storyType) {
        relatedVideos.push(other.videoId);
      } else if (
        other.product.mainProduct === record.product.mainProduct &&
        record.product.mainProduct !== "none"
      ) {
        relatedVideos.push(other.videoId);
      }
    }

    const relatedCampaigns = [...analysis.relationships.relatedCampaigns];
    if (record.marketingGoal) relatedCampaigns.push(`${record.marketingGoal}-campaign`);

    return {
      relatedProducts: [...new Set(relatedProducts)],
      relatedBrands: [...new Set(relatedBrands)],
      relatedCampaigns: [...new Set(relatedCampaigns)],
      relatedImages: [...new Set(analysis.relationships.relatedImages)],
      relatedStoryboards: [...new Set(storyboards)],
      relatedScripts: [...new Set(scripts)],
      relatedCreativePlans: [...new Set(creativePlans)],
      relatedKnowledge: [
        ...new Set([
          ...knowledgeIds,
          ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
          ...analysis.relationships.relatedKnowledge,
        ]),
      ],
      relatedVideos: [...new Set([...relatedVideos, ...analysis.relationships.relatedVideos])].slice(0, 10),
      relatedMemory: [...new Set(analysis.relationships.relatedMemory)],
      relatedProjects: [
        ...new Set([...projects, ...analysis.relationships.relatedProjects]),
      ],
    };
  }
}

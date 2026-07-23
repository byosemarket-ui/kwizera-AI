import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import { BrandVisualIntelligenceRecord, BrandVisualIntelligenceRelationships } from "./types.js";

export class BrandVisualLinker {
  detectRelationships(
    record: BrandVisualIntelligenceRecord,
    allRecords: BrandVisualIntelligenceRecord[],
    analysis: ImageAnalysisIntelligenceRecord,
    understanding: ImageUnderstandingRecord,
    detection: ObjectDetectionRecord,
    projects: string[] = [],
    knowledgeIds: string[] = []
  ): BrandVisualIntelligenceRelationships {
    const relatedImages: string[] = [];

    for (const other of allRecords) {
      if (other.imageId === record.imageId) continue;

      const sharedBrand = other.profile.brandName === record.profile.brandName;
      const sharedStyle = other.visualStyle === record.visualStyle;

      if (sharedBrand || sharedStyle) {
        relatedImages.push(other.imageId);
      }
    }

    return {
      relatedProducts: [
        ...new Set([
          ...(detection.productDetection.mainProduct ? [detection.productDetection.mainProduct] : []),
          ...detection.productDetection.secondaryProducts,
          ...analysis.content.products,
          ...analysis.relationships.relatedProducts,
        ]),
      ],
      relatedImages: [...new Set([...relatedImages, ...analysis.relationships.relatedImages])].slice(0, 10),
      relatedCampaigns: [
        ...analysis.relationships.relatedMarketingCampaigns,
        ...understanding.relationships.relatedMarketingCampaigns,
      ],
      relatedCreativeStyles: [
        record.profile.graphicStyle,
        ...understanding.relationships.relatedCreativeStyles,
        analysis.classification.creativeStyle,
      ],
      relatedStoryboards: [
        `storyboard-${record.visualStyle}`,
        `brand-${record.profile.brandId}`,
      ],
      relatedVisualPlans: [
        record.planning.visualStylePlan.slice(0, 50),
        record.planning.colorApplicationPlan.slice(0, 50),
      ],
      relatedMarketingStrategies: [
        understanding.marketing.promotionalPurpose,
        understanding.marketing.marketingOpportunity,
      ].filter(Boolean),
      relatedKnowledge: [
        ...new Set([
          ...knowledgeIds,
          ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
          ...analysis.relationships.relatedKnowledge,
          ...understanding.relationships.relatedKnowledge,
        ]),
      ],
      relatedProjects: [
        ...new Set([
          ...projects,
          ...analysis.relationships.relatedProjects,
          ...understanding.relationships.relatedProjects,
        ]),
      ],
    };
  }
}

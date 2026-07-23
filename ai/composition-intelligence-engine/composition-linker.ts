import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import { CompositionIntelligenceRecord, CompositionIntelligenceRelationships } from "./types.js";

export class CompositionLinker {
  detectRelationships(
    record: CompositionIntelligenceRecord,
    allRecords: CompositionIntelligenceRecord[],
    analysis: ImageAnalysisIntelligenceRecord,
    understanding: ImageUnderstandingRecord,
    detection: ObjectDetectionRecord,
    background: BackgroundIntelligenceRecord | null,
    projects: string[] = [],
    knowledgeIds: string[] = []
  ): CompositionIntelligenceRelationships {
    const relatedImages: string[] = [];

    for (const other of allRecords) {
      if (other.imageId === record.imageId) continue;

      const sharedType =
        other.compositionAnalysis.compositionType === record.compositionAnalysis.compositionType;
      const sharedBrand = other.relationships.relatedBrands.some((b) =>
        record.relationships.relatedBrands.includes(b)
      );
      const sharedProduct = other.relationships.relatedProducts.some((p) =>
        record.relationships.relatedProducts.includes(p)
      );

      if (sharedType || sharedBrand || sharedProduct) {
        relatedImages.push(other.imageId);
      }
    }

    return {
      relatedProducts: [
        ...new Set([
          ...(detection.productDetection.mainProduct ? [detection.productDetection.mainProduct] : []),
          ...detection.productDetection.secondaryProducts,
          ...analysis.relationships.relatedProducts,
        ]),
      ],
      relatedBrands: [
        ...new Set([
          detection.logoDetection.brandAssociation,
          understanding.brand.brandIdentity,
          ...analysis.relationships.relatedBrands,
          ...understanding.relationships.relatedBrands,
        ]),
      ].filter((b) => b && b !== "unknown-brand"),
      relatedCreativeStyles: [
        ...understanding.relationships.relatedCreativeStyles,
        analysis.classification.creativeStyle,
      ],
      relatedBackgrounds: [
        ...new Set([
          ...(background ? [background.backgroundLabel] : []),
          analysis.content.background,
          ...detection.relationships.relatedBackgrounds,
        ]),
      ].filter(Boolean),
      relatedStoryboards: [
        `storyboard-${record.compositionAnalysis.compositionType}`,
        `scene-${understanding.scene.sceneType}`,
      ],
      relatedMarketingCampaigns: [
        ...analysis.relationships.relatedMarketingCampaigns,
        ...understanding.relationships.relatedMarketingCampaigns,
      ],
      relatedKnowledge: [
        ...new Set([
          ...knowledgeIds,
          ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
          ...analysis.relationships.relatedKnowledge,
          ...understanding.relationships.relatedKnowledge,
          ...(background?.relationships.relatedKnowledge ?? []),
        ]),
      ],
      relatedImages: [...new Set([...relatedImages, ...analysis.relationships.relatedImages])].slice(0, 10),
      relatedProjects: [
        ...new Set([
          ...projects,
          ...analysis.relationships.relatedProjects,
          ...understanding.relationships.relatedProjects,
          ...detection.relationships.relatedProjects,
        ]),
      ],
    };
  }
}

import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { LightingColorIntelligenceRecord, LightingColorIntelligenceRelationships } from "./types.js";

export class LightingColorLinker {
  detectRelationships(
    record: LightingColorIntelligenceRecord,
    allRecords: LightingColorIntelligenceRecord[],
    analysis: ImageAnalysisIntelligenceRecord,
    understanding: ImageUnderstandingRecord,
    composition: CompositionIntelligenceRecord | null,
    background: BackgroundIntelligenceRecord | null,
    projects: string[] = [],
    knowledgeIds: string[] = []
  ): LightingColorIntelligenceRelationships {
    const relatedImages: string[] = [];

    for (const other of allRecords) {
      if (other.imageId === record.imageId) continue;

      const sharedPalette = other.color.dominantColors.some((c) =>
        record.color.dominantColors.includes(c)
      );
      const sharedLighting = other.lighting.lightingType === record.lighting.lightingType;
      const sharedBrand = other.relationships.relatedBrands.some((b) =>
        record.relationships.relatedBrands.includes(b)
      );

      if (sharedPalette || sharedLighting || sharedBrand) {
        relatedImages.push(other.imageId);
      }
    }

    return {
      relatedProducts: [
        ...new Set([
          ...(analysis.content.products[0] ? [analysis.content.products[0]] : []),
          ...analysis.content.products.slice(1),
          ...analysis.relationships.relatedProducts,
        ]),
      ],
      relatedBrands: [
        ...new Set([
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
          analysis.content.background,
          ...(background ? [background.backgroundLabel] : []),
        ]),
      ].filter(Boolean),
      relatedCompositionPlans: [
        ...(composition ? [`composition-${composition.compositionAnalysis.compositionType}`] : []),
        ...(composition ? [composition.improvementPlan.framingStrategy.slice(0, 40)] : []),
      ],
      relatedStoryboards: [
        `storyboard-${record.lighting.lightingType}`,
        `color-grade-${record.color.colorTemperature}`,
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
        ]),
      ],
      relatedImages: [...new Set([...relatedImages, ...analysis.relationships.relatedImages])].slice(0, 10),
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

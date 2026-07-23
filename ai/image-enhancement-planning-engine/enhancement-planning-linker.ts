import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { LightingColorIntelligenceRecord } from "../lighting-color-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { ImageEnhancementPlanningRecord, ImageEnhancementPlanningRelationships } from "./types.js";

export class EnhancementPlanningLinker {
  detectRelationships(
    record: ImageEnhancementPlanningRecord,
    allRecords: ImageEnhancementPlanningRecord[],
    analysis: ImageAnalysisIntelligenceRecord,
    understanding: ImageUnderstandingRecord,
    background: BackgroundIntelligenceRecord | null,
    composition: CompositionIntelligenceRecord | null,
    lightingColor: LightingColorIntelligenceRecord | null,
    projects: string[] = [],
    knowledgeIds: string[] = []
  ): ImageEnhancementPlanningRelationships {
    const relatedImages: string[] = [];

    for (const other of allRecords) {
      if (other.imageId === record.imageId) continue;
      if (
        other.profile.brand === record.profile.brand ||
        other.profile.product === record.profile.product
      ) {
        relatedImages.push(other.imageId);
      }
    }

    return {
      relatedImages: [...new Set([...relatedImages, ...analysis.relationships.relatedImages])].slice(0, 10),
      relatedProducts: [
        ...new Set([record.profile.product, ...analysis.content.products, ...analysis.relationships.relatedProducts]),
      ].filter((p) => p && p !== "unspecified-product"),
      relatedBrands: [
        ...new Set([record.profile.brand, ...analysis.relationships.relatedBrands, ...understanding.relationships.relatedBrands]),
      ].filter((b) => b && b !== "unknown-brand"),
      relatedBackgroundIntelligence: background ? [background.backgroundId] : [],
      relatedCompositionIntelligence: composition ? [composition.compositionId] : [],
      relatedLightingIntelligence: lightingColor ? [lightingColor.lightingColorId] : [],
      relatedCreativeStyles: [
        analysis.classification.creativeStyle,
        ...understanding.relationships.relatedCreativeStyles,
      ],
      relatedProjects: [
        ...new Set([
          record.profile.projectId,
          ...projects,
          ...analysis.relationships.relatedProjects,
          ...understanding.relationships.relatedProjects,
        ]),
      ],
      relatedKnowledge: [
        ...new Set([
          ...knowledgeIds,
          ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
          ...analysis.relationships.relatedKnowledge,
          ...understanding.relationships.relatedKnowledge,
        ]),
      ],
    };
  }
}

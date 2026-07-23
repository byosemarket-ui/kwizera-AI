import {
  ImageAnalysisIntelligenceRecord,
  ImageAnalysisRelationships,
  ImageAnalysisType,
  ImageClassification,
} from "./types.js";

export class ImageAnalysisLinker {
  detectRelationships(
    record: ImageAnalysisIntelligenceRecord,
    allRecords: ImageAnalysisIntelligenceRecord[],
    knowledgeIds: string[] = [],
    memoryRefs: string[] = []
  ): ImageAnalysisRelationships {
    const relatedImages: string[] = [];
    const relatedBrands: string[] = [];
    const relatedProducts: string[] = [];
    const relatedCreativeStyles: string[] = [record.classification.creativeStyle];

    const product = record.relationships?.relatedProducts?.[0] ?? record.content.products[0];
    const brand = record.relationships?.relatedBrands?.[0];

    for (const other of allRecords) {
      if (other.imageId === record.imageId) continue;

      if (brand && other.relationships.relatedBrands.includes(brand)) {
        relatedImages.push(other.imageId);
        if (!relatedBrands.includes(brand)) relatedBrands.push(brand);
      } else if (product && other.content.products.includes(product)) {
        relatedImages.push(other.imageId);
        if (!relatedProducts.includes(product)) relatedProducts.push(product);
      } else if (other.classification.imageType === record.classification.imageType) {
        relatedImages.push(other.imageId);
      } else if (other.classification.creativeStyle === record.classification.creativeStyle) {
        relatedImages.push(other.imageId);
        if (!relatedCreativeStyles.includes(other.classification.creativeStyle)) {
          relatedCreativeStyles.push(other.classification.creativeStyle);
        }
      }
    }

    return {
      relatedProducts: [...new Set([...(record.relationships?.relatedProducts ?? []), ...relatedProducts])],
      relatedBrands: [...new Set([...(record.relationships?.relatedBrands ?? []), ...relatedBrands])],
      relatedProjects: record.relationships?.relatedProjects ?? [],
      relatedMarketingCampaigns: record.relationships?.relatedMarketingCampaigns ?? [],
      relatedCreativeStyles: [...new Set(relatedCreativeStyles)],
      relatedKnowledge: [...new Set([...(record.relationships?.relatedKnowledge ?? []), ...knowledgeIds])],
      relatedImages: [...new Set([...(record.relationships?.relatedImages ?? []), ...relatedImages])].slice(0, 10),
      relatedMemory: [...new Set([...(record.relationships?.relatedMemory ?? []), ...memoryRefs])],
    };
  }

  classifySimilarity(a: ImageClassification, b: ImageClassification): number {
    let score = 0;
    if (a.imageType === b.imageType) score += 35;
    if (a.category === b.category) score += 25;
    if (a.subcategory === b.subcategory) score += 20;
    if (a.creativeStyle === b.creativeStyle) score += 10;
    if (a.useCase === b.useCase) score += 10;
    return score;
  }
}

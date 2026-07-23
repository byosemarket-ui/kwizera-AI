import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { BrandingDesignRecord } from "../branding-design-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import {
  MultiStyleImageInput,
  MultiStyleImageRecord,
  MultiStyleImageRelationships,
} from "./types.js";

export class MultiStyleImageLinker {
  detectRelationships(
    record: MultiStyleImageRecord,
    input: MultiStyleImageInput,
    productImagePlan?: ProductImageGenerationRecord | null,
    brandingPlan?: BrandingDesignRecord | null,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): MultiStyleImageRelationships {
    const relationships: MultiStyleImageRelationships = {
      products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: record.profile.campaignId ? [record.profile.campaignId] : [],
      templates: input.templateIds ?? [],
      prompts: [record.profile.promptId],
      sourceImages: [record.profile.sourceImageId],
      generatedImages: [record.profile.generatedStyleImageId],
      knowledgeRecords: input.knowledgeRecordIds ?? [],
      productImagePlans: input.productImagePlanId
        ? [input.productImagePlanId]
        : productImagePlan
          ? [productImagePlan.productImagePlanId]
          : [],
      brandingPlans: input.brandingPlanId
        ? [input.brandingPlanId]
        : brandingPlan
          ? [brandingPlan.brandDesignId]
          : [],
    };

    if (understanding?.productId && !relationships.products.includes(understanding.productId)) {
      relationships.products.push(understanding.productId);
    }
    if (creative?.profile.brand && !relationships.brands.includes(creative.profile.brand)) {
      relationships.brands.push(creative.profile.brand);
    }
    if (strategy?.relationships.campaigns.length) {
      relationships.campaigns.push(
        ...strategy.relationships.campaigns.filter((c) => !relationships.campaigns.includes(c))
      );
    }

    return relationships;
  }
}

import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  SoundEffectsGenerationInput,
  SoundEffectsGenerationRecord,
  SoundEffectsRelationships,
} from "./types.js";

export class SoundEffectsGenerationLinker {
  detectRelationships(
    record: SoundEffectsGenerationRecord,
    input: SoundEffectsGenerationInput,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): SoundEffectsRelationships {
    const relationships: SoundEffectsRelationships = {
      soundPlans: [record.soundPlanId],
      musicPlans: input.musicPlanIds ?? [],
      voicePlans: input.voicePlanIds ?? [],
      products: input.productId ? [input.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: input.campaignId ? [input.campaignId] : record.profile.campaignId ? [record.profile.campaignId] : [],
      videos: input.videoId ? [input.videoId] : input.videoRef ? [input.videoRef] : [],
      images: input.imageId ? [input.imageId] : input.imageRef ? [input.imageRef] : [],
      knowledgeRecords: input.knowledgeRecordIds ?? [],
    };

    if (understanding?.productId && !relationships.products.includes(understanding.productId)) {
      relationships.products.push(understanding.productId);
    }
    if (creative?.profile.brand && !relationships.brands.includes(creative.profile.brand)) {
      relationships.brands.push(creative.profile.brand);
    }

    return relationships;
  }
}

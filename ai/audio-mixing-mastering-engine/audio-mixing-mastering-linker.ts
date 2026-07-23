import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  AudioMixMasterGenerationInput,
  AudioMixMasterGenerationRecord,
  AudioMixMasterRelationships,
} from "./types.js";

export class AudioMixingMasteringLinker {
  detectRelationships(
    record: AudioMixMasterGenerationRecord,
    input: AudioMixMasterGenerationInput,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): AudioMixMasterRelationships {
    const relationships: AudioMixMasterRelationships = {
      mixingPlans: [record.mixingPlanId],
      masteringPlans: [record.masteringPlanId],
      voicePlans: input.voicePlanIds ?? [],
      musicPlans: input.musicPlanIds ?? [],
      ambientPlans: input.ambientPlanIds ?? [],
      soundPlans: input.soundPlanIds ?? [],
      enhancementPlans: input.enhancementPlanIds ?? [],
      products: input.productId ? [input.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: input.campaignId ? [input.campaignId] : record.profile.campaignId ? [record.profile.campaignId] : [],
      videos: input.videoId ? [input.videoId] : [],
      knowledgeRecords: input.knowledgeRecordIds ?? [],
    };

    if (understanding?.productId && !relationships.products.includes(understanding.productId)) {
      relationships.products.push(understanding.productId);
    }
    if (creative?.profile.brand && !relationships.brands.includes(creative.profile.brand)) {
      relationships.brands.push(creative.profile.brand);
    }
    if (strategy?.strategyId && !relationships.campaigns.includes(strategy.strategyId)) {
      relationships.campaigns.push(strategy.strategyId);
    }

    return relationships;
  }
}

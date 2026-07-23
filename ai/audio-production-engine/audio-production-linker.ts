import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { AudioProductionInput, AudioProductionRecord, AudioProductionRelationships } from "./types.js";

export class AudioProductionLinker {
  detectRelationships(
    record: AudioProductionRecord,
    input: AudioProductionInput,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): AudioProductionRelationships {
    const relationships: AudioProductionRelationships = {
      audioPlans: [record.profile.audioPlanId],
      productionPlans: [record.audioProductionId],
      voicePlans: input.voicePlanIds ?? [],
      musicPlans: input.musicPlanIds ?? [],
      ambientPlans: input.ambientPlanIds ?? [],
      soundPlans: input.soundPlanIds ?? [],
      enhancementPlans: input.enhancementPlanIds ?? [],
      mixingPlans: input.mixingPlanId ? [input.mixingPlanId] : [],
      masteringPlans: input.masteringPlanId ? [input.masteringPlanId] : [],
      products: input.productId ? [input.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: input.campaignId ? [input.campaignId] : [record.profile.campaignId],
      videos: input.videoId ? [input.videoId] : [],
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

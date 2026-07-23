import type { AudioProductionRecord } from "../audio-production-engine/types.js";
import { AudioRenderInput, AudioRenderRecord, AudioRenderRelationships } from "./types.js";

export class AudioRenderLinker {
  detectRelationships(
    record: AudioRenderRecord,
    input: AudioRenderInput,
    productionPlan?: AudioProductionRecord | null,
    productId?: string
  ): AudioRenderRelationships {
    return {
      audioPlans: productionPlan ? [productionPlan.profile.audioPlanId] : input.audioPlanId ? [input.audioPlanId] : [],
      productionPlans: input.productionId
        ? [input.productionId]
        : productionPlan
          ? [productionPlan.audioProductionId]
          : [],
      renderPlans: [record.audioRenderPlanId],
      voicePlans: input.voicePlanIds ?? productionPlan?.relationships.voicePlans ?? [],
      musicPlans: input.musicPlanIds ?? productionPlan?.relationships.musicPlans ?? [],
      products: productId ? [productId] : productionPlan ? productionPlan.relationships.products : [],
      brands: productionPlan?.profile.brandId
        ? [productionPlan.profile.brandId]
        : input.brandId
          ? [input.brandId]
          : input.brandName
            ? [input.brandName]
            : [],
      campaigns: productionPlan?.profile.campaignId ? [productionPlan.profile.campaignId] : input.campaignId ? [input.campaignId] : [],
      knowledgeRecords: input.knowledgeRecordIds ?? productionPlan?.relationships.knowledgeRecords ?? [],
    };
  }
}

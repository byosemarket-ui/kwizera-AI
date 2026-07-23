import type { AudioProductionRecord } from "../audio-production-engine/types.js";
import type { AudioRenderRecord } from "../audio-rendering-preparation-engine/types.js";
import {
  AudioQualityValidationInput,
  AudioQualityValidationRecord,
  AudioQualityValidationRelationships,
} from "./types.js";

export class AudioQualityValidationLinker {
  detectRelationships(
    record: AudioQualityValidationRecord,
    input: AudioQualityValidationInput,
    productionPlan?: AudioProductionRecord | null,
    renderPlan?: AudioRenderRecord | null
  ): AudioQualityValidationRelationships {
    return {
      audioPlans: record.profile.audioPlanId ? [record.profile.audioPlanId] : [],
      productionPlans: input.productionId
        ? [input.productionId]
        : productionPlan
          ? [productionPlan.audioProductionId]
          : [],
      renderPlans: input.renderPlanId
        ? [input.renderPlanId]
        : renderPlan
          ? [renderPlan.audioRenderPlanId]
          : [],
      voicePlans: input.voicePlanIds ?? productionPlan?.relationships.voicePlans ?? renderPlan?.relationships.voicePlans ?? [],
      musicPlans: input.musicPlanIds ?? productionPlan?.relationships.musicPlans ?? renderPlan?.relationships.musicPlans ?? [],
      soundPlans: input.soundPlanIds ?? productionPlan?.relationships.soundPlans ?? [],
      ambientPlans: input.ambientPlanIds ?? productionPlan?.relationships.ambientPlans ?? [],
      products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: productionPlan?.profile.campaignId ? [productionPlan.profile.campaignId] : input.campaignId ? [input.campaignId] : [],
      knowledgeRecords: input.knowledgeRecordIds ?? productionPlan?.relationships.knowledgeRecords ?? [],
    };
  }
}

import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  VoiceCloningGenerationInput,
  VoiceCloningGenerationRecord,
  VoiceCloningRelationships,
} from "./types.js";

export class VoiceCloningGenerationLinker {
  detectRelationships(
    record: VoiceCloningGenerationRecord,
    input: VoiceCloningGenerationInput,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): VoiceCloningRelationships {
    const relationships: VoiceCloningRelationships = {
      voiceSamples: [record.profile.sampleId],
      voiceProfiles: [record.profile.voiceProfileId],
      consentRecords: [record.profile.consentId],
      products: input.productId ? [input.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: input.campaignId ? [input.campaignId] : record.profile.campaignId ? [record.profile.campaignId] : [],
      videos: [],
      knowledgeRecords: input.knowledgeRecordIds ?? [],
      productionPlans: [],
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

import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  SpeechToSpeechGenerationInput,
  SpeechToSpeechGenerationRecord,
  SpeechToSpeechRelationships,
} from "./types.js";

export class SpeechToSpeechGenerationLinker {
  detectRelationships(
    record: SpeechToSpeechGenerationRecord,
    input: SpeechToSpeechGenerationInput,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): SpeechToSpeechRelationships {
    const relationships: SpeechToSpeechRelationships = {
      sourceAudio: [record.profile.sourceAudioId],
      targetVoices: [record.profile.targetVoiceId],
      voiceProfiles: [record.profile.sourceVoiceId, record.profile.targetVoiceId],
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

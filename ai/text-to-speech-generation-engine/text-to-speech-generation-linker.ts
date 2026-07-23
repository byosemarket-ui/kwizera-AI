import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  TextToSpeechGenerationInput,
  TextToSpeechGenerationRecord,
  TextToSpeechRelationships,
} from "./types.js";

export class TextToSpeechGenerationLinker {
  detectRelationships(
    record: TextToSpeechGenerationRecord,
    input: TextToSpeechGenerationInput,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): TextToSpeechRelationships {
    const relationships: TextToSpeechRelationships = {
      scripts: [record.profile.scriptId],
      voices: [record.profile.voiceProfileId],
      products: input.productId ? [input.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: input.campaignId ? [input.campaignId] : record.profile.campaignId ? [record.profile.campaignId] : [],
      videos: [],
      images: [],
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

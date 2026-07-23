import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { AudienceIntelligenceRecord } from "../audience-intelligence-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { CreativeDirectionRecord, CreativeRelationships } from "./types.js";

export class CreativeDirectionLinker {
  detectRelationships(
    record: CreativeDirectionRecord,
    allRecords: CreativeDirectionRecord[],
    understanding: ProductUnderstandingRecord,
    analysis: ProductAnalysisIntelligenceRecord,
    strategy: MarketingStrategyRecord,
    audience: AudienceIntelligenceRecord
  ): CreativeRelationships {
    const products = [record.productId];
    const brands = [understanding.identity.brand];
    const creativeStyles = [
      record.profile.creativeStyle,
      ...strategy.relationships.creativeStyles,
      ...audience.relationships.creativeStyles,
    ];
    const campaigns = [...strategy.relationships.campaigns];
    const storyboards: string[] = [];
    const scripts: string[] = [];
    const visualPlans: string[] = [];
    const audioPlans: string[] = [];

    if (strategy.creativePreparation.storyboardReady) {
      storyboards.push(`storyboard-prep-${record.creativeId}`);
    }
    if (strategy.creativePreparation.scriptPlanningReady) {
      scripts.push(`script-prep-${record.creativeId}`);
    }
    if (strategy.creativePreparation.visualPlanningReady) {
      visualPlans.push(`visual-prep-${record.creativeId}`);
    }
    if (strategy.creativePreparation.audioPlanningReady) {
      audioPlans.push(`audio-prep-${record.creativeId}`);
    }

    const knowledgeRecords = [
      ...new Set([
        ...understanding.relationships.knowledgeRecords,
        ...audience.relationships.knowledgeRecords,
        ...strategy.relationships.knowledgeRecords,
        ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
      ]),
    ];

    for (const other of allRecords) {
      if (other.creativeId === record.creativeId) continue;
      if (other.profile.creativeStyle === record.profile.creativeStyle) {
        creativeStyles.push(other.profile.creativeStyle);
      }
    }

    return {
      products: [...new Set(products)],
      brands: [...new Set(brands)],
      creativeStyles: [...new Set(creativeStyles.map(String))].slice(0, 12),
      campaigns: [...new Set(campaigns)],
      storyboards: [...new Set(storyboards)],
      scripts: [...new Set(scripts)],
      visualPlans: [...new Set(visualPlans)],
      audioPlans: [...new Set(audioPlans)],
      knowledgeRecords,
    };
  }
}

import crypto from "node:crypto";
import { MarketingPatternStore } from "./marketing-pattern-store.js";
import { MarketingPattern, MarketingRecord } from "./types.js";

const MIN_CONFIDENCE = 55;

export class MarketingPatternDetector {
  constructor(private readonly patternStore: MarketingPatternStore) {}

  detect(campaign: MarketingRecord): MarketingPattern[] {
    const detected: MarketingPattern[] = [];
    const now = new Date().toISOString();
    const id = campaign.campaignId;

    if (campaign.campaign.campaignStructure && campaign.campaign.campaignFlow) {
      detected.push(
        this.create(
          "campaign-structure",
          `Structure: ${campaign.campaign.campaignStructure} → ${campaign.campaign.campaignFlow}`,
          id,
          78,
          now
        )
      );
    }

    for (const headline of campaign.content.headlines) {
      if (headline.length > 10) {
        detected.push(this.create("headline", `Headline: ${headline.slice(0, 60)}`, id, 72, now));
      }
    }

    for (const hook of campaign.content.hooks) {
      if (hook.length > 5) {
        detected.push(this.create("hook", `Hook: ${hook.slice(0, 60)}`, id, 75, now));
      }
    }

    for (const cta of campaign.content.callToActions) {
      detected.push(this.create("cta", `CTA: ${cta}`, id, 80, now));
    }

    if (campaign.campaign.customerProblem && campaign.campaign.solution) {
      detected.push(
        this.create(
          "storytelling",
          `Problem→Solution: ${campaign.campaign.customerProblem.slice(0, 40)} → ${campaign.campaign.solution.slice(0, 40)}`,
          id,
          76,
          now
        )
      );
    }

    if (campaign.campaign.productPresentation && campaign.content.sellingPoints.length > 0) {
      detected.push(
        this.create(
          "product-positioning",
          `Positioning: ${campaign.campaign.productPresentation} with ${campaign.content.sellingPoints.length} selling point(s)`,
          id,
          74,
          now
        )
      );
    }

    const qualified = detected.filter((p) => p.confidence >= MIN_CONFIDENCE);
    for (const pattern of qualified) {
      this.patternStore.store(pattern);
    }
    return qualified;
  }

  private create(
    type: MarketingPattern["patternType"],
    description: string,
    sourceCampaignId: string,
    confidence: number,
    detectedAt: string
  ): MarketingPattern {
    return {
      patternId: `mpat-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      patternType: type,
      description,
      sourceCampaignId,
      confidence,
      reusable: confidence >= 60,
      detectedAt,
    };
  }
}

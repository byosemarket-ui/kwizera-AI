import {
  BrandStrategyKnowledge,
  CampaignKnowledge,
  ContentKnowledge,
  CustomerJourneyKnowledge,
  CustomerPsychologyKnowledge,
  KnowledgeCampaignType,
  KnowledgeMarketingGoal,
  KnowledgeMarketingPlatform,
  MarketingAnalysisInput,
  MarketingStructureKnowledge,
  MarketingStyle,
  PlatformKnowledge,
  ProductPositioningKnowledge,
  StorytellingKnowledge,
} from "./types.js";

export class MarketingAnalyzer {
  analyze(input: MarketingAnalysisInput): {
    campaignType: KnowledgeCampaignType;
    marketingGoal: KnowledgeMarketingGoal;
    brand: BrandStrategyKnowledge;
    positioning: ProductPositioningKnowledge;
    customerJourney: CustomerJourneyKnowledge;
    customer: CustomerPsychologyKnowledge;
    structure: MarketingStructureKnowledge;
    campaign: CampaignKnowledge;
    content: ContentKnowledge;
    platformKnowledge: PlatformKnowledge;
    storytelling: StorytellingKnowledge;
    platform: KnowledgeMarketingPlatform;
    audience: string;
  } {
    const product = input.product ?? input.positioning?.productName ?? "KWIZERA Pro";
    const brandName = input.brandName ?? "KWIZERA";

    const brand: BrandStrategyKnowledge = {
      brandVoice: input.brand?.brandVoice ?? "confident-innovative",
      brandPersonality: input.brand?.brandPersonality ?? "creative-professional",
      brandPositioning: input.brand?.brandPositioning ?? "premium AI creative studio",
      brandMessaging: input.brand?.brandMessaging ?? "Create smarter, faster, better",
      brandColors: input.brand?.brandColors ?? ["#1a1a2e", "#e94560", "#ffffff"],
      brandConsistency: input.brand?.brandConsistency ?? 85,
    };

    const positioning: ProductPositioningKnowledge = {
      productName: product,
      valueProposition:
        input.positioning?.valueProposition ?? "AI-powered creative production for professionals",
      uniqueSellingPoints: input.positioning?.uniqueSellingPoints ?? [
        "automated workflows",
        "brand consistency",
        "multi-platform output",
      ],
      competitiveAdvantage:
        input.positioning?.competitiveAdvantage ?? "integrated knowledge-driven AI studio",
      targetSegment: input.positioning?.targetSegment ?? input.audience ?? "creative professionals",
      positioningStatement:
        input.positioning?.positioningStatement ??
        `${product} — the intelligent creative studio for modern brands`,
    };

    const customerJourney: CustomerJourneyKnowledge = {
      awarenessStage: input.customerJourney?.awarenessStage ?? "social-discovery",
      considerationStage: input.customerJourney?.considerationStage ?? "demo-and-comparison",
      decisionStage: input.customerJourney?.decisionStage ?? "trial-to-subscription",
      retentionStage: input.customerJourney?.retentionStage ?? "workflow-integration",
      touchpoints: input.customerJourney?.touchpoints ?? [
        "social media",
        "website",
        "email",
        "product demo",
      ],
    };

    const customer: CustomerPsychologyKnowledge = {
      customerIntent: input.customer?.customerIntent ?? "improve creative output efficiency",
      customerMotivation: input.customer?.customerMotivation ?? "save time while maintaining quality",
      customerNeeds: input.customer?.customerNeeds ?? [
        "faster production",
        "brand consistency",
        "professional results",
      ],
      customerInterests: input.customer?.customerInterests ?? [
        "AI tools",
        "video marketing",
        "brand growth",
      ],
      customerBehavior: input.customer?.customerBehavior ?? "research-driven, values demonstrations",
      buyingTriggers: input.customer?.buyingTriggers ?? [
        "time savings proof",
        "portfolio quality",
        "peer recommendations",
      ],
      trustFactors: input.customer?.trustFactors ?? [
        "case studies",
        "transparent pricing",
        "professional support",
      ],
      decisionFactors: input.customer?.decisionFactors ?? [
        "ROI",
        "ease of use",
        "output quality",
      ],
    };

    const structure: MarketingStructureKnowledge = {
      hook: input.structure?.hook ?? "Transform your creative workflow in minutes",
      introduction: input.structure?.introduction ?? `Introducing ${product} by ${brandName}`,
      productPresentation: input.structure?.productPresentation ?? "hero-demo-with-benefits",
      problem: input.structure?.problem ?? "Creative teams struggle with slow, inconsistent production",
      solution: input.structure?.solution ?? `${product} automates and elevates every creative step`,
      benefits: input.structure?.benefits ?? [
        "10x faster production",
        "consistent brand output",
        "multi-platform campaigns",
      ],
      socialProof: input.structure?.socialProof ?? "trusted by 500+ creative professionals",
      offer: input.structure?.offer ?? "Start your free trial today",
      callToAction: input.structure?.callToAction ?? "Get Started — Free Trial",
      closing: input.structure?.closing ?? "brand-lockup-with-urgency-cta",
    };

    const campaign: CampaignKnowledge = {
      campaignObjective:
        input.campaign?.campaignObjective ?? input.marketingGoal ?? KnowledgeMarketingGoal.Conversion,
      campaignFlow: input.campaign?.campaignFlow ?? "hook → problem → solution → proof → offer → cta",
      campaignTiming: input.campaign?.campaignTiming ?? "always-on with seasonal peaks",
      audienceTargeting: input.campaign?.audienceTargeting ?? input.audience ?? "creative professionals 25-45",
      brandingConsistency: input.campaign?.brandingConsistency ?? brand.brandConsistency,
      marketingStyle: input.campaign?.marketingStyle ?? MarketingStyle.StoryDriven,
      performanceIndicators: input.campaign?.performanceIndicators ?? [
        "CTR",
        "conversion rate",
        "engagement rate",
        "ROAS",
      ],
    };

    const content: ContentKnowledge = {
      headlines: input.content?.headlines ?? [
        structure.hook,
        `Why ${brandName} changes everything`,
        `Create like a pro with ${product}`,
      ],
      captions: input.content?.captions ?? [
        `Discover ${product} — your AI creative partner.`,
        `Stop wasting hours. Start creating smarter.`,
      ],
      productDescriptions: input.content?.productDescriptions ?? [
        positioning.positioningStatement,
        positioning.valueProposition,
      ],
      keywords: input.content?.keywords ?? input.keywords ?? [
        "AI studio",
        "creative automation",
        brandName.toLowerCase(),
        product.toLowerCase(),
      ],
      hashtags: input.content?.hashtags ?? [
        "#AIcreative",
        "#marketing",
        `#${brandName.toLowerCase()}`,
      ],
      promotionalScripts: input.content?.promotionalScripts ?? [
        `${structure.hook}. ${structure.problem}. ${structure.solution}. ${structure.callToAction}.`,
      ],
      voiceStyle: input.content?.voiceStyle ?? "professional-energetic",
      copywritingStyle: input.content?.copywritingStyle ?? "benefit-driven-conversational",
    };

    const platform = input.platform ?? input.platformKnowledge?.platform ?? KnowledgeMarketingPlatform.Instagram;
    const platformKnowledge: PlatformKnowledge = {
      platform,
      contentFormat: input.platformKnowledge?.contentFormat ?? this.defaultContentFormat(platform),
      optimalLength: input.platformKnowledge?.optimalLength ?? this.defaultOptimalLength(platform),
      bestPractices: input.platformKnowledge?.bestPractices ?? this.defaultBestPractices(platform),
    };

    const storytelling: StorytellingKnowledge = {
      narrativeArc: input.storytelling?.narrativeArc ?? "problem-agitation-solution",
      emotionalFlow: input.storytelling?.emotionalFlow ?? "curiosity → empathy → desire → action",
      hookTiming: input.storytelling?.hookTiming ?? 3,
      storyPacing: input.storytelling?.storyPacing ?? "fast-open-medium-body-strong-close",
      characterOrBrandRole: input.storytelling?.characterOrBrandRole ?? `${brandName} as creative enabler`,
    };

    return {
      campaignType: input.campaignType ?? KnowledgeCampaignType.Conversion,
      marketingGoal: input.marketingGoal ?? KnowledgeMarketingGoal.Conversion,
      brand,
      positioning,
      customerJourney,
      customer,
      structure,
      campaign,
      content,
      platformKnowledge,
      storytelling,
      platform,
      audience: input.audience ?? positioning.targetSegment,
    };
  }

  private defaultContentFormat(platform: KnowledgeMarketingPlatform): string {
    const formats: Record<KnowledgeMarketingPlatform, string> = {
      [KnowledgeMarketingPlatform.TikTok]: "vertical-short-video",
      [KnowledgeMarketingPlatform.Instagram]: "reels-and-carousel",
      [KnowledgeMarketingPlatform.Facebook]: "video-and-image-ads",
      [KnowledgeMarketingPlatform.YouTube]: "pre-roll-and-shorts",
      [KnowledgeMarketingPlatform.WhatsApp]: "status-and-broadcast",
      [KnowledgeMarketingPlatform.Website]: "landing-page-hero",
      [KnowledgeMarketingPlatform.Future]: "adaptive-multi-format",
    };
    return formats[platform];
  }

  private defaultOptimalLength(platform: KnowledgeMarketingPlatform): string {
    const lengths: Record<KnowledgeMarketingPlatform, string> = {
      [KnowledgeMarketingPlatform.TikTok]: "15-60 seconds",
      [KnowledgeMarketingPlatform.Instagram]: "15-90 seconds",
      [KnowledgeMarketingPlatform.Facebook]: "30-120 seconds",
      [KnowledgeMarketingPlatform.YouTube]: "30 seconds - 3 minutes",
      [KnowledgeMarketingPlatform.WhatsApp]: "30-60 seconds",
      [KnowledgeMarketingPlatform.Website]: "hero-30s + scroll content",
      [KnowledgeMarketingPlatform.Future]: "platform-adaptive",
    };
    return lengths[platform];
  }

  private defaultBestPractices(platform: KnowledgeMarketingPlatform): string[] {
    const practices: Record<KnowledgeMarketingPlatform, string[]> = {
      [KnowledgeMarketingPlatform.TikTok]: ["hook in 1s", "trending audio", "native feel"],
      [KnowledgeMarketingPlatform.Instagram]: ["visual-first", "strong CTA in caption", "hashtag mix"],
      [KnowledgeMarketingPlatform.Facebook]: ["clear value prop", "social proof", "retargeting funnels"],
      [KnowledgeMarketingPlatform.YouTube]: ["skip-proof hook", "brand in first 5s", "end screen CTA"],
      [KnowledgeMarketingPlatform.WhatsApp]: ["personal tone", "direct CTA", "shareable format"],
      [KnowledgeMarketingPlatform.Website]: ["above-fold CTA", "trust signals", "mobile-first"],
      [KnowledgeMarketingPlatform.Future]: ["omnichannel consistency", "adaptive creative"],
    };
    return practices[platform];
  }
}

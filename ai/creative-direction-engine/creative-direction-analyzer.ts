import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { AudienceIntelligenceRecord } from "../audience-intelligence-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import { StrategyType } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  BrandDirection,
  CinematicDirection,
  CreativeDirectionInput,
  CreativeDirectionProfile,
  CreativePlatform,
  CreativeDirectionStyle,
  MarketingDirection,
  PlatformCreativeDirection,
  VisualDirection,
} from "./types.js";

const STRATEGY_TO_STYLE: Record<StrategyType, CreativeDirectionStyle> = {
  [StrategyType.Emotional]: CreativeDirectionStyle.Emotional,
  [StrategyType.Educational]: CreativeDirectionStyle.Educational,
  [StrategyType.Promotional]: CreativeDirectionStyle.Promotional,
  [StrategyType.Storytelling]: CreativeDirectionStyle.Storytelling,
  [StrategyType.Demonstration]: CreativeDirectionStyle.Demonstration,
  [StrategyType.Luxury]: CreativeDirectionStyle.Luxury,
  [StrategyType.Lifestyle]: CreativeDirectionStyle.Lifestyle,
  [StrategyType.SocialProof]: CreativeDirectionStyle.SocialProof,
  [StrategyType.ValueBased]: CreativeDirectionStyle.ValueBased,
  [StrategyType.ProblemSolution]: CreativeDirectionStyle.ProblemSolution,
};

const INDUSTRY_PALETTE: Record<string, string[]> = {
  technology: ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#ffffff"],
  fashion: ["#2d2d2d", "#c9a96e", "#f5f0eb", "#8b7355", "#ffffff"],
  beauty: ["#fce4ec", "#f8bbd9", "#e91e63", "#880e4f", "#ffffff"],
  food: ["#ff6f00", "#ffa726", "#fff3e0", "#4e342e", "#ffffff"],
  general: ["#263238", "#37474f", "#78909c", "#eceff1", "#ffffff"],
};

const INDUSTRY_MOOD: Record<string, { mood: string; tone: string }> = {
  technology: { mood: "innovative and confident", tone: "professional and forward-thinking" },
  fashion: { mood: "aspirational and bold", tone: "stylish and expressive" },
  beauty: { mood: "radiant and nurturing", tone: "warm and empowering" },
  food: { mood: "appetizing and inviting", tone: "sensory and authentic" },
  general: { mood: "trustworthy and engaging", tone: "clear and benefit-focused" },
};

const PLATFORM_SPECS: Record<
  CreativePlatform,
  { aspectRatio: string; duration: string; pacing: string; optimizations: string[] }
> = {
  [CreativePlatform.TikTok]: {
    aspectRatio: "9:16",
    duration: "15-60 seconds",
    pacing: "fast hook, rapid cuts",
    optimizations: ["hook in 1s", "trending audio", "native vertical feel"],
  },
  [CreativePlatform.InstagramReels]: {
    aspectRatio: "9:16",
    duration: "15-90 seconds",
    pacing: "visual-first, smooth transitions",
    optimizations: ["strong opening frame", "caption CTA", "hashtag mix"],
  },
  [CreativePlatform.Facebook]: {
    aspectRatio: "1:1 or 16:9",
    duration: "30-120 seconds",
    pacing: "clear value prop early",
    optimizations: ["sound-off captions", "social proof", "retargeting friendly"],
  },
  [CreativePlatform.YouTubeShorts]: {
    aspectRatio: "9:16",
    duration: "15-60 seconds",
    pacing: "skip-proof hook, fast payoff",
    optimizations: ["brand in first 3s", "end screen CTA", "loop-friendly outro"],
  },
  [CreativePlatform.YouTube]: {
    aspectRatio: "16:9",
    duration: "30s - 3 minutes",
    pacing: "narrative build with clear chapters",
    optimizations: ["skip-proof hook", "chapter markers", "end screen CTA"],
  },
  [CreativePlatform.WhatsAppStatus]: {
    aspectRatio: "9:16",
    duration: "30-60 seconds",
    pacing: "personal and direct",
    optimizations: ["personal tone", "direct CTA", "shareable format"],
  },
  [CreativePlatform.Website]: {
    aspectRatio: "16:9 hero, responsive",
    duration: "hero 30s + scroll content",
    pacing: "above-fold impact, scroll reveal",
    optimizations: ["above-fold CTA", "trust signals", "mobile-first"],
  },
};

export class CreativeDirectionAnalyzer {
  buildProfile(
    input: CreativeDirectionInput,
    strategy: MarketingStrategyRecord,
    audience: AudienceIntelligenceRecord,
    understanding: ProductUnderstandingRecord,
    analysis: ProductAnalysisIntelligenceRecord
  ): CreativeDirectionProfile {
    const primaryStrategy = strategy.selectedStrategies.find((s) => s.priority === "primary");
    const creativeStyle = primaryStrategy
      ? (STRATEGY_TO_STYLE[primaryStrategy.strategyType] ?? CreativeDirectionStyle.ModernMinimal)
      : CreativeDirectionStyle.ModernMinimal;

    const industry = analysis.classification.industry;
    const moodTone = INDUSTRY_MOOD[industry] ?? INDUSTRY_MOOD.general;
    const platform = input.platform ?? this.inferPrimaryPlatform(strategy);

    const creativeId = input.creativeId ?? `creative-${input.productId}-${platform}`;
    const projectId = input.projectId ?? `project-${input.productId}`;

    return {
      creativeId,
      projectId,
      product: understanding.identity.productName,
      brand: understanding.identity.brand,
      campaignGoal: input.campaignGoal ?? strategy.marketingObjective,
      targetAudience: audience.profile.audienceName,
      platform,
      creativeTheme: strategy.campaignDirection.messagingTheme,
      creativeStyle,
      mood: moodTone.mood,
      tone: audience.profile.preferredCommunicationStyle || moodTone.tone,
      emotionalDirection: this.buildEmotionalDirection(creativeStyle, audience, understanding),
    };
  }

  buildVisualDirection(
    profile: CreativeDirectionProfile,
    understanding: ProductUnderstandingRecord,
    analysis: ProductAnalysisIntelligenceRecord,
    strategy: MarketingStrategyRecord
  ): VisualDirection {
    const industry = analysis.classification.industry;
    const palette = INDUSTRY_PALETTE[industry] ?? INDUSTRY_PALETTE.general;
    const isPremium = analysis.profile.price >= 150 || profile.creativeStyle === CreativeDirectionStyle.Luxury;

    return {
      colorPalette: palette,
      typographyStyle: isPremium ? "elegant serif headlines with clean sans body" : "modern sans-serif, high legibility",
      designStyle: isPremium ? "minimal luxury with generous whitespace" : "clean modern with bold accents",
      compositionStyle: profile.creativeStyle === CreativeDirectionStyle.Lifestyle ? "rule-of-thirds lifestyle framing" : "center-weighted product hero",
      productPlacement: `Feature ${understanding.identity.productName} prominently — ${strategy.creativePreparation.visualPlanningDirection}`,
      backgroundStyle: industry === "beauty" || industry === "fashion" ? "soft gradient or lifestyle context" : "neutral or contextual environment",
      lightingStyle: isPremium ? "soft key light with subtle rim lighting" : "bright even lighting with natural shadows",
      visualHierarchy: `Brand → Product → Benefit → CTA — emphasize ${understanding.uniqueValue.keyBenefits[0] ?? "core value"}`,
      iconStyle: "rounded minimal line icons matching brand palette",
      graphicStyle: `${profile.creativeStyle} overlays with brand-consistent shapes and accents`,
    };
  }

  buildCinematicDirection(
    profile: CreativeDirectionProfile,
    strategy: MarketingStrategyRecord,
    understanding: ProductUnderstandingRecord
  ): CinematicDirection {
    const isDynamic = profile.creativeStyle === CreativeDirectionStyle.Promotional || profile.platform === CreativePlatform.TikTok;
    const isCinematic = profile.creativeStyle === CreativeDirectionStyle.Luxury || profile.creativeStyle === CreativeDirectionStyle.Storytelling;

    return {
      cameraStyle: isCinematic ? "cinematic shallow depth-of-field" : "clean documentary style",
      cameraMovement: isDynamic ? "dynamic tracking and quick pans" : "steady controlled movement",
      framingStyle: profile.creativeStyle === CreativeDirectionStyle.Lifestyle ? "wide establishing to intimate close-ups" : "medium close-up product focus",
      sceneRhythm: isDynamic ? "fast-paced 2-4 second beats" : "measured 4-8 second scenes",
      motionStyle: isDynamic ? "energetic kinetic motion graphics" : "smooth subtle animations",
      transitionStyle: isDynamic ? "quick cuts and whip transitions" : "dissolve and fade transitions",
      introStyle: `Hook addressing ${understanding.customer.customerPainPoints[0] ?? "customer need"} in first 3 seconds`,
      outroStyle: `Brand lockup with CTA — ${strategy.campaignDirection.timingGuidance}`,
      editingStyle: `${profile.platform} optimized — ${strategy.creativePreparation.productionPlanningDirection}`,
    };
  }

  buildBrandDirection(
    profile: CreativeDirectionProfile,
    understanding: ProductUnderstandingRecord,
    analysis: ProductAnalysisIntelligenceRecord
  ): BrandDirection {
    const palette = INDUSTRY_PALETTE[analysis.classification.industry] ?? INDUSTRY_PALETTE.general;

    return {
      logoPlacement: "top-left or end-card center, minimum clear space equal to logo height",
      brandColors: palette.slice(0, 3),
      brandTypography: profile.creativeStyle === CreativeDirectionStyle.Luxury ? "premium serif + sans pairing" : "brand sans-serif system",
      brandIdentity: `${understanding.identity.brand} — ${understanding.identity.valueProposition}`,
      brandVoice: profile.tone,
      brandConsistency: `Maintain ${understanding.identity.brand} visual and verbal identity across all ${profile.platform} touchpoints`,
    };
  }

  buildMarketingDirection(
    profile: CreativeDirectionProfile,
    strategy: MarketingStrategyRecord,
    understanding: ProductUnderstandingRecord,
    audience: AudienceIntelligenceRecord
  ): MarketingDirection {
    const primary = strategy.selectedStrategies.find((s) => s.priority === "primary");

    return {
      hookDirection: `Open with ${audience.psychological.buyingIntent} — address ${audience.psychological.customerChallenges[0] ?? "key challenge"}`,
      storytellingDirection: strategy.creativePreparation.storyboardDirection,
      productPresentation: `Showcase ${understanding.identity.productName} via ${primary?.strategyType.replace(/-/g, " ") ?? "primary"} approach — ${understanding.uniqueValue.uniqueSellingPoints[0] ?? "core feature"}`,
      emotionalFlow: `Build from ${profile.mood} introduction to confident resolution aligned with ${profile.emotionalDirection}`,
      callToActionPlacement: profile.platform === CreativePlatform.Website ? "above-fold and end-of-scroll" : "final 5 seconds and caption overlay",
      closingStrategy: strategy.campaignDirection.campaignFocus,
    };
  }

  buildPlatformDirections(
    profile: CreativeDirectionProfile,
    strategy: MarketingStrategyRecord,
    understanding: ProductUnderstandingRecord
  ): PlatformCreativeDirection[] {
    const primaryPlatform = profile.platform;
    const relatedPlatforms = this.platformsFromStrategy(strategy);
    const allPlatforms = [...new Set([primaryPlatform, ...relatedPlatforms])];

    return allPlatforms.map((platform) => {
      const specs = PLATFORM_SPECS[platform];
      return {
        platform,
        formatGuidance: `${profile.creativeStyle} creative optimized for ${platform.replace(/-/g, " ")}`,
        aspectRatio: specs.aspectRatio,
        durationGuidance: specs.duration,
        contentPacing: specs.pacing,
        platformOptimizations: [
          ...specs.optimizations,
          `Brand: ${understanding.identity.brand}`,
          `Theme: ${profile.creativeTheme.slice(0, 60)}`,
        ],
      };
    });
  }

  private inferPrimaryPlatform(strategy: MarketingStrategyRecord): CreativePlatform {
    const platforms = strategy.audienceAlignment.preferredPlatforms;
    const first = platforms[0];
    const map: Record<string, CreativePlatform> = {
      tiktok: CreativePlatform.TikTok,
      instagram: CreativePlatform.InstagramReels,
      facebook: CreativePlatform.Facebook,
      youtube: CreativePlatform.YouTube,
      whatsapp: CreativePlatform.WhatsAppStatus,
      website: CreativePlatform.Website,
    };
    if (first && map[first]) return map[first];
    return CreativePlatform.Website;
  }

  private platformsFromStrategy(strategy: MarketingStrategyRecord): CreativePlatform[] {
    const result: CreativePlatform[] = [];
    for (const p of strategy.audienceAlignment.preferredPlatforms) {
      if (p === "tiktok") result.push(CreativePlatform.TikTok);
      else if (p === "instagram") result.push(CreativePlatform.InstagramReels);
      else if (p === "facebook") result.push(CreativePlatform.Facebook);
      else if (p === "youtube") result.push(CreativePlatform.YouTubeShorts, CreativePlatform.YouTube);
      else if (p === "whatsapp") result.push(CreativePlatform.WhatsAppStatus);
      else if (p === "website") result.push(CreativePlatform.Website);
    }
    return [...new Set(result)];
  }

  private buildEmotionalDirection(
    style: CreativeDirectionStyle,
    audience: AudienceIntelligenceRecord,
    understanding: ProductUnderstandingRecord
  ): string {
    const motivations = audience.psychological.customerMotivation.join(", ");
    const benefits = understanding.customer.customerBenefits.slice(0, 2).join(" and ");
    return `${style} creative evoking ${audience.psychological.buyingIntent} — connect ${motivations} with ${benefits}`;
  }
}

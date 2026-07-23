import {
  BrandAnalysisInput,
  BrandCommunicationKnowledge,
  BrandConsistencyCheck,
  BrandIdentityProfile,
  BrandMarketingStyle,
  KnowledgeBrandIndustry,
  VisualBrandKnowledge,
} from "./types.js";

const INDUSTRY_DEFAULTS: Record<
  KnowledgeBrandIndustry,
  { personality: string; tone: string; designLanguage: string }
> = {
  [KnowledgeBrandIndustry.Technology]: {
    personality: "innovative-trustworthy",
    tone: "confident-clear",
    designLanguage: "modern-minimal-tech",
  },
  [KnowledgeBrandIndustry.Creative]: {
    personality: "bold-inspiring",
    tone: "energetic-creative",
    designLanguage: "dynamic-expressive",
  },
  [KnowledgeBrandIndustry.Fashion]: {
    personality: "stylish-aspirational",
    tone: "elegant-trendy",
    designLanguage: "editorial-premium",
  },
  [KnowledgeBrandIndustry.Beauty]: {
    personality: "warm-refined",
    tone: "gentle-luxurious",
    designLanguage: "soft-premium",
  },
  [KnowledgeBrandIndustry.Food]: {
    personality: "warm-appetizing",
    tone: "friendly-inviting",
    designLanguage: "organic-vibrant",
  },
  [KnowledgeBrandIndustry.Hospitality]: {
    personality: "welcoming-premium",
    tone: "warm-professional",
    designLanguage: "elegant-comfortable",
  },
  [KnowledgeBrandIndustry.Education]: {
    personality: "knowledgeable-supportive",
    tone: "clear-encouraging",
    designLanguage: "clean-accessible",
  },
  [KnowledgeBrandIndustry.Health]: {
    personality: "caring-credible",
    tone: "reassuring-professional",
    designLanguage: "clean-medical",
  },
  [KnowledgeBrandIndustry.Automotive]: {
    personality: "powerful-reliable",
    tone: "bold-assured",
    designLanguage: "sleek-dynamic",
  },
  [KnowledgeBrandIndustry.RealEstate]: {
    personality: "trustworthy-aspirational",
    tone: "professional-warm",
    designLanguage: "spacious-premium",
  },
  [KnowledgeBrandIndustry.General]: {
    personality: "professional-friendly",
    tone: "clear-balanced",
    designLanguage: "versatile-modern",
  },
  [KnowledgeBrandIndustry.Future]: {
    personality: "adaptive-forward",
    tone: "flexible-modern",
    designLanguage: "evolving-identity",
  },
};

export class BrandAnalyzer {
  analyze(input: BrandAnalysisInput): {
    profile: BrandIdentityProfile;
    visual: VisualBrandKnowledge;
    communication: BrandCommunicationKnowledge;
    marketingStyle: BrandMarketingStyle;
    history: string[];
    consistency: BrandConsistencyCheck;
  } {
    const brandId = input.brandId ?? input.profile?.brandId ?? `brand-${Date.now()}`;
    const brandName = input.brandName ?? input.profile?.brandName ?? "Unnamed Brand";
    const industry =
      input.industry ?? input.profile?.industry ?? KnowledgeBrandIndustry.Technology;
    const defaults = INDUSTRY_DEFAULTS[industry];

    const profile: BrandIdentityProfile = {
      brandId,
      brandName,
      brandDescription:
        input.brandDescription ??
        input.profile?.brandDescription ??
        `${brandName} — a leading brand in ${industry}`,
      industry,
      brandMission:
        input.brandMission ?? input.profile?.brandMission ?? `Empower through ${brandName}`,
      brandVision:
        input.brandVision ??
        input.profile?.brandVision ??
        `Be the most trusted ${industry} brand globally`,
      brandValues:
        input.brandValues ??
        input.profile?.brandValues ??
        ["innovation", "quality", "trust", "creativity"],
      brandPersonality:
        input.brandPersonality ?? input.profile?.brandPersonality ?? defaults.personality,
      brandTone: input.brandTone ?? input.profile?.brandTone ?? defaults.tone,
      brandTargetAudience:
        input.brandTargetAudience ??
        input.profile?.brandTargetAudience ??
        "professionals and creative teams",
      brandPositioning:
        input.brandPositioning ??
        input.profile?.brandPositioning ??
        `Premium ${industry} brand for modern audiences`,
    };

    const visual: VisualBrandKnowledge = {
      logo: input.visual?.logo ?? `${brandName.toLowerCase()}-primary-logo`,
      logoVariations: input.visual?.logoVariations ?? [
        "primary-horizontal",
        "icon-only",
        "monochrome",
      ],
      logoUsageRules: input.visual?.logoUsageRules ?? [
        "minimum clear space equal to logo height",
        "never distort or recolor outside palette",
        "use monochrome on dark backgrounds",
      ],
      brandColors: input.visual?.brandColors ?? ["#1a1a2e", "#e94560", "#ffffff", "#16213e"],
      typography: input.visual?.typography ?? "Inter / modern sans-serif",
      icons: input.visual?.icons ?? ["line-icons", "rounded-corners"],
      designLanguage: input.visual?.designLanguage ?? defaults.designLanguage,
      visualIdentity: input.visual?.visualIdentity ?? `${brandName} premium visual system`,
      layoutStyle: input.visual?.layoutStyle ?? "grid-based-clean",
      backgroundStyle: input.visual?.backgroundStyle ?? "gradient-dark-premium",
      motionStyle: input.visual?.motionStyle ?? "smooth-ease-subtle",
      introStyle: input.visual?.introStyle ?? "logo-reveal-scale-fade",
      outroStyle: input.visual?.outroStyle ?? "brand-lockup-with-cta",
    };

    const communication: BrandCommunicationKnowledge = {
      brandVoice: input.communication?.brandVoice ?? `${defaults.personality} voice`,
      writingStyle: input.communication?.writingStyle ?? "concise-benefit-driven",
      messagingStyle: input.communication?.messagingStyle ?? "value-first-storytelling",
      storytellingStyle: input.communication?.storytellingStyle ?? "problem-solution-proof",
      marketingTone: input.communication?.marketingTone ?? profile.brandTone,
      customerCommunication: input.communication?.customerCommunication ?? "supportive-proactive",
      callToActionStyle: input.communication?.callToActionStyle ?? "action-oriented-clear",
      emotionalStyle: input.communication?.emotionalStyle ?? "confidence-inspiration",
    };

    const marketingStyle = input.marketingStyle ?? BrandMarketingStyle.Professional;
    const history = input.history ?? [`${brandName} brand established`, "identity system defined"];

    const consistency = this.evaluateConsistency(profile, visual, communication, input);

    return { profile, visual, communication, marketingStyle, history, consistency };
  }

  evaluateConsistency(
    profile: BrandIdentityProfile,
    visual: VisualBrandKnowledge,
    communication: BrandCommunicationKnowledge,
    input: BrandAnalysisInput
  ): BrandConsistencyCheck {
    const inconsistencies: string[] = [];

    const logoUsage =
      visual.logo && visual.logoUsageRules.length >= 2 ? 90 : visual.logo ? 70 : 40;
    const colorUsage = visual.brandColors.length >= 3 ? 92 : visual.brandColors.length >= 1 ? 75 : 45;
    const typography = visual.typography ? 88 : 50;
    const voiceConsistency =
      communication.brandVoice && profile.brandTone ? 90 : communication.brandVoice ? 72 : 45;
    const messagingConsistency =
      communication.messagingStyle && profile.brandPositioning ? 88 : 60;
    const visualConsistency =
      visual.designLanguage && visual.visualIdentity ? 90 : visual.designLanguage ? 75 : 50;
    const marketingConsistency =
      communication.marketingTone === profile.brandTone ? 92 : communication.marketingTone ? 78 : 55;
    const animationConsistency =
      visual.motionStyle && visual.introStyle && visual.outroStyle ? 88 : 65;

    if (logoUsage < 70) inconsistencies.push("Logo usage rules incomplete");
    if (colorUsage < 70) inconsistencies.push("Brand color palette insufficient");
    if (voiceConsistency < 70) inconsistencies.push("Brand voice and tone misaligned");
    if (marketingConsistency < 75) inconsistencies.push("Marketing tone differs from brand tone");
    if (input.visual?.brandColors?.length === 1) {
      inconsistencies.push("Single-color palette limits brand flexibility");
    }

    const scores = [
      logoUsage,
      colorUsage,
      typography,
      voiceConsistency,
      messagingConsistency,
      visualConsistency,
      marketingConsistency,
      animationConsistency,
    ];
    const overallConsistency = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    return {
      logoUsage,
      colorUsage,
      typography,
      voiceConsistency,
      messagingConsistency,
      visualConsistency,
      marketingConsistency,
      animationConsistency,
      overallConsistency,
      inconsistencies,
    };
  }
}

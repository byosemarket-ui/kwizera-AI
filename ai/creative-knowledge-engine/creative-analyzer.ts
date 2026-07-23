import {
  AnimationKnowledge,
  CinematicKnowledge,
  CreativeAnalysisInput,
  CreativeStorytellingKnowledge,
  KnowledgeCreativeDirectionStyle,
  KnowledgeCreativeDomain,
  KnowledgeCreativeMarketingGoal,
  KnowledgeCreativePlatform,
  SocialCreativeKnowledge,
  VisualDesignKnowledge,
} from "./types.js";

const DOMAIN_DEFAULTS: Record<
  KnowledgeCreativeDomain,
  { layout: string; composition: string; storyStructure: string }
> = {
  [KnowledgeCreativeDomain.GraphicDesign]: {
    layout: "grid-based",
    composition: "rule-of-thirds",
    storyStructure: "visual-message-hierarchy",
  },
  [KnowledgeCreativeDomain.MotionGraphics]: {
    layout: "dynamic-layered",
    composition: "centered-hero",
    storyStructure: "motion-driven-narrative",
  },
  [KnowledgeCreativeDomain.VideoEditing]: {
    layout: "timeline-sequential",
    composition: "scene-continuity",
    storyStructure: "hook-product-cta",
  },
  [KnowledgeCreativeDomain.Storyboarding]: {
    layout: "panel-sequence",
    composition: "shot-progression",
    storyStructure: "scene-by-scene",
  },
  [KnowledgeCreativeDomain.AdvertisingDesign]: {
    layout: "conversion-focused",
    composition: "product-hero",
    storyStructure: "problem-solution-cta",
  },
  [KnowledgeCreativeDomain.PosterDesign]: {
    layout: "poster-vertical",
    composition: "bold-hierarchy",
    storyStructure: "single-message-impact",
  },
  [KnowledgeCreativeDomain.SocialMediaDesign]: {
    layout: "mobile-first",
    composition: "thumb-stopping",
    storyStructure: "hook-value-cta",
  },
  [KnowledgeCreativeDomain.ThumbnailDesign]: {
    layout: "compact-impact",
    composition: "face-product-contrast",
    storyStructure: "curiosity-hook",
  },
  [KnowledgeCreativeDomain.ProductShowcase]: {
    layout: "product-hero",
    composition: "orbit-showcase",
    storyStructure: "reveal-benefits-cta",
  },
  [KnowledgeCreativeDomain.PresentationDesign]: {
    layout: "slide-deck",
    composition: "clean-hierarchy",
    storyStructure: "intro-content-close",
  },
  [KnowledgeCreativeDomain.UIInspiration]: {
    layout: "interface-grid",
    composition: "component-hierarchy",
    storyStructure: "user-flow",
  },
  [KnowledgeCreativeDomain.CreativeDirection]: {
    layout: "brand-system",
    composition: "unified-visual-language",
    storyStructure: "brand-narrative",
  },
};

export class CreativeAnalyzer {
  analyze(input: CreativeAnalysisInput): {
    domain: KnowledgeCreativeDomain;
    creativeStyle: KnowledgeCreativeDirectionStyle;
    platform: KnowledgeCreativePlatform;
    industry: string;
    brandName: string;
    productName: string;
    marketingGoal: KnowledgeCreativeMarketingGoal;
    colorPalette: string[];
    animationStyle: string;
    visual: VisualDesignKnowledge;
    storytelling: CreativeStorytellingKnowledge;
    animation: AnimationKnowledge;
    cinematic: CinematicKnowledge;
    social: SocialCreativeKnowledge;
  } {
    const domain = input.domain ?? KnowledgeCreativeDomain.AdvertisingDesign;
    const defaults = DOMAIN_DEFAULTS[domain];
    const brandName = input.brandName ?? "KWIZERA";
    const productName = input.productName ?? "KWIZERA Pro";
    const palette = input.colorPalette ?? ["#1a1a2e", "#e94560", "#ffffff"];

    const visual: VisualDesignKnowledge = {
      composition: input.visual?.composition ?? defaults.composition,
      layout: input.visual?.layout ?? defaults.layout,
      balance: input.visual?.balance ?? 85,
      contrast: input.visual?.contrast ?? 82,
      colorHarmony: input.visual?.colorHarmony ?? "complementary-warm",
      typography: input.visual?.typography ?? "Inter / bold headlines",
      visualHierarchy: input.visual?.visualHierarchy ?? "headline-product-cta",
      negativeSpace: input.visual?.negativeSpace ?? 78,
      whiteSpace: input.visual?.whiteSpace ?? 80,
      iconography: input.visual?.iconography ?? "line-icons-rounded",
      gridSystem: input.visual?.gridSystem ?? "12-column",
    };

    const storytelling: CreativeStorytellingKnowledge = {
      storyStructure: input.storytelling?.storyStructure ?? defaults.storyStructure,
      sceneFlow: input.storytelling?.sceneFlow ?? "hook → showcase → proof → cta",
      emotionalJourney: input.storytelling?.emotionalJourney ?? "curiosity → desire → action",
      attentionRetention: input.storytelling?.attentionRetention ?? 88,
      productReveal: input.storytelling?.productReveal ?? "hero-orbit-reveal",
      narrativeFlow: input.storytelling?.narrativeFlow ?? "progressive-build",
      visualRhythm: input.storytelling?.visualRhythm ?? "medium-paced-commercial",
      endingStrategy: input.storytelling?.endingStrategy ?? "brand-lockup-cta",
    };

    const animation: AnimationKnowledge = {
      motionPrinciples: input.animation?.motionPrinciples ?? [
        "anticipation",
        "staging",
        "ease-timing",
      ],
      timing: input.animation?.timing ?? "beat-synced",
      spacing: input.animation?.spacing ?? "smooth-progressive",
      easeIn: input.animation?.easeIn ?? "cubic-bezier(0.4, 0, 0.2, 1)",
      easeOut: input.animation?.easeOut ?? "cubic-bezier(0, 0, 0.2, 1)",
      motionCurves: input.animation?.motionCurves ?? "ease-in-out",
      cameraMotion: input.animation?.cameraMotion ?? "slow-orbit",
      objectAnimation: input.animation?.objectAnimation ?? "scale-fade",
      textAnimation: input.animation?.textAnimation ?? "slide-up-fade",
      logoAnimation: input.animation?.logoAnimation ?? "scale-reveal",
      animationQuality: input.animation?.animationQuality ?? 85,
    };

    const cinematic: CinematicKnowledge = {
      cameraLanguage: input.cinematic?.cameraLanguage ?? "dynamic-product-orbit",
      lighting: input.cinematic?.lighting ?? "three-point-studio",
      framing: input.cinematic?.framing ?? "medium-close-product",
      composition: input.cinematic?.composition ?? defaults.composition,
      colorGrading: input.cinematic?.colorGrading ?? "warm-commercial",
      scenePacing: input.cinematic?.scenePacing ?? "medium-fast",
      transitions: input.cinematic?.transitions ?? ["cross-dissolve", "fade", "wipe"],
      visualContinuity: input.cinematic?.visualContinuity ?? 88,
    };

    const platform = input.platform ?? input.social?.platform ?? KnowledgeCreativePlatform.Instagram;
    const social: SocialCreativeKnowledge = {
      platform,
      format: input.social?.format ?? this.defaultFormat(platform),
      bestPractices: input.social?.bestPractices ?? this.defaultBestPractices(platform),
      hookStrategy: input.social?.hookStrategy ?? "visual-hook-first-3s",
      aspectRatio: input.social?.aspectRatio ?? this.defaultAspectRatio(platform),
    };

    return {
      domain,
      creativeStyle: input.creativeStyle ?? KnowledgeCreativeDirectionStyle.Premium,
      platform,
      industry: input.industry ?? "creative-technology",
      brandName,
      productName,
      marketingGoal: input.marketingGoal ?? KnowledgeCreativeMarketingGoal.Conversion,
      colorPalette: palette,
      animationStyle: input.animationStyle ?? "smooth-commercial",
      visual,
      storytelling,
      animation,
      cinematic,
      social,
    };
  }

  private defaultFormat(platform: KnowledgeCreativePlatform): string {
    const formats: Record<KnowledgeCreativePlatform, string> = {
      [KnowledgeCreativePlatform.TikTok]: "vertical-short",
      [KnowledgeCreativePlatform.Instagram]: "reels-square",
      [KnowledgeCreativePlatform.Facebook]: "feed-video",
      [KnowledgeCreativePlatform.YouTube]: "landscape-long",
      [KnowledgeCreativePlatform.YouTubeShorts]: "vertical-short",
      [KnowledgeCreativePlatform.WhatsApp]: "status-vertical",
      [KnowledgeCreativePlatform.Future]: "adaptive",
    };
    return formats[platform];
  }

  private defaultAspectRatio(platform: KnowledgeCreativePlatform): string {
    const ratios: Record<KnowledgeCreativePlatform, string> = {
      [KnowledgeCreativePlatform.TikTok]: "9:16",
      [KnowledgeCreativePlatform.Instagram]: "9:16",
      [KnowledgeCreativePlatform.Facebook]: "16:9",
      [KnowledgeCreativePlatform.YouTube]: "16:9",
      [KnowledgeCreativePlatform.YouTubeShorts]: "9:16",
      [KnowledgeCreativePlatform.WhatsApp]: "9:16",
      [KnowledgeCreativePlatform.Future]: "multi",
    };
    return ratios[platform];
  }

  private defaultBestPractices(platform: KnowledgeCreativePlatform): string[] {
    const practices: Record<KnowledgeCreativePlatform, string[]> = {
      [KnowledgeCreativePlatform.TikTok]: ["hook in 1s", "native feel", "trending motion"],
      [KnowledgeCreativePlatform.Instagram]: ["visual-first", "brand colors", "strong CTA"],
      [KnowledgeCreativePlatform.Facebook]: ["clear value", "social proof", "retargeting"],
      [KnowledgeCreativePlatform.YouTube]: ["skip-proof hook", "brand early", "end screen"],
      [KnowledgeCreativePlatform.YouTubeShorts]: ["vertical framing", "fast pacing", "text overlay"],
      [KnowledgeCreativePlatform.WhatsApp]: ["personal tone", "direct CTA", "shareable"],
      [KnowledgeCreativePlatform.Future]: ["omnichannel consistency"],
    };
    return practices[platform];
  }
}

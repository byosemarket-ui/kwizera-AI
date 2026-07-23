import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import { ImageAnalysisType } from "../image-analysis-engine/types.js";
import type { BrandVisualIntelligenceRecord, BrandVisualStyle } from "../brand-visual-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { ImageEnhancementPlanningRecord } from "../image-enhancement-planning-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { ImageUnderstandingPlatform } from "../image-understanding-engine/types.js";
import {
  CreativeImageProfile,
  CreativeImageRecommendation,
  CreativeLayoutType,
  CreativeImagePlatform,
  CreativeProductionInstructions,
  CreativeStyleCategory,
  CreativeStylePlanning,
  LayoutPlanning,
  MarketingLayoutType,
  MarketingPreparation,
  PlatformPreparation,
} from "./types.js";

export class CreativeImageAnalyzer {
  buildFromIntelligence(
    analysis: ImageAnalysisIntelligenceRecord,
    understanding: ImageUnderstandingRecord,
    composition: CompositionIntelligenceRecord,
    brandVisual: BrandVisualIntelligenceRecord,
    enhancementPlan: ImageEnhancementPlanningRecord | null,
    projectId?: string,
    campaign?: string,
    platform?: CreativeImagePlatform,
    layoutType?: CreativeLayoutType,
    creativeStyle?: CreativeStyleCategory,
    marketingType?: MarketingLayoutType
  ): {
    profile: CreativeImageProfile;
    layoutPlanning: LayoutPlanning;
    creativeStylePlan: CreativeStylePlanning;
    marketingPreparation: MarketingPreparation;
    platformPreparation: PlatformPreparation;
    productionInstructions: CreativeProductionInstructions;
    recommendations: CreativeImageRecommendation[];
    keywords: string[];
  } {
    const targetPlatform = platform ?? this.inferPlatform(analysis, understanding);
    const targetLayout = layoutType ?? this.inferLayoutType(analysis, composition);
    const product = analysis.content.products[0] ?? "unspecified-product";
    const brand = brandVisual.profile.brandName ?? understanding.brand.brandIdentity ?? analysis.content.logos[0] ?? "unknown-brand";
    const campaignName = campaign ?? understanding.relationships.relatedMarketingCampaigns[0] ?? String(understanding.marketingGoal);

    const stylePlan = this.buildCreativeStyle(brandVisual, creativeStyle, analysis.classification.creativeStyle);
    const layoutPlanning = this.buildLayoutPlanning(composition, brandVisual, targetLayout, targetPlatform);
    const marketingPreparation = this.buildMarketingPreparation(understanding, marketingType, product, brand);
    const platformPreparation = this.buildPlatformPreparation(
      composition,
      brandVisual,
      enhancementPlan,
      targetPlatform
    );
    const productionInstructions = this.buildProductionInstructions(
      layoutPlanning,
      stylePlan,
      marketingPreparation,
      targetPlatform,
      brand
    );

    const profile: CreativeImageProfile = {
      creativeImageId: `creative-image-${analysis.imageId}`,
      projectId: projectId ?? "default-project",
      imageId: analysis.imageId,
      product,
      brand,
      campaign: campaignName,
      platform: targetPlatform,
      creativeVersion: "1.0",
    };

    const recommendations = this.buildRecommendations(
      layoutPlanning,
      stylePlan,
      marketingPreparation,
      brandVisual,
      composition,
      targetPlatform
    );

    const keywords = [
      ...analysis.keywords,
      product,
      brand,
      campaignName,
      targetPlatform,
      targetLayout,
      stylePlan.primaryStyle,
      ...recommendations.map((r) => r.category),
    ].filter(Boolean);

    return {
      profile,
      layoutPlanning,
      creativeStylePlan: stylePlan,
      marketingPreparation,
      platformPreparation,
      productionInstructions,
      recommendations,
      keywords,
    };
  }

  private inferPlatform(
    analysis: ImageAnalysisIntelligenceRecord,
    understanding: ImageUnderstandingRecord
  ): CreativeImagePlatform {
    const platform = understanding.platform;
    if (platform === ImageUnderstandingPlatform.Social) {
      if (analysis.classification.imageType === ImageAnalysisType.Banner) return CreativeImagePlatform.WebsiteBanner;
      return CreativeImagePlatform.InstagramPost;
    }
    if (platform === ImageUnderstandingPlatform.Mobile) return CreativeImagePlatform.WhatsAppStatus;
    if (analysis.classification.imageType === ImageAnalysisType.Banner) return CreativeImagePlatform.WebsiteBanner;
    if (analysis.classification.imageType === ImageAnalysisType.Poster) return CreativeImagePlatform.FacebookPost;
    return CreativeImagePlatform.WebsiteBanner;
  }

  private inferLayoutType(
    analysis: ImageAnalysisIntelligenceRecord,
    composition: CompositionIntelligenceRecord
  ): CreativeLayoutType {
    const suitability = composition.suitability;
    if (analysis.classification.imageType === ImageAnalysisType.Banner) return CreativeLayoutType.Banner;
    if (suitability.thumbnail >= 80) return CreativeLayoutType.Thumbnail;
    if (suitability.poster >= 75) return CreativeLayoutType.Poster;
    if (suitability.advertisement >= 75) return CreativeLayoutType.Advertisement;
    if (suitability.socialMedia >= 70) return CreativeLayoutType.SocialMedia;
    if (suitability.productShowcase >= 70) return CreativeLayoutType.ProductShowcase;
    return CreativeLayoutType.Branding;
  }

  private mapBrandStyle(style: BrandVisualStyle | string): CreativeStyleCategory {
    const map: Record<string, CreativeStyleCategory> = {
      luxury: CreativeStyleCategory.Luxury,
      modern: CreativeStyleCategory.Modern,
      minimal: CreativeStyleCategory.Minimal,
      corporate: CreativeStyleCategory.Corporate,
      technology: CreativeStyleCategory.Technology,
      fashion: CreativeStyleCategory.Fashion,
      beauty: CreativeStyleCategory.Beauty,
      food: CreativeStyleCategory.Food,
      "real-estate": CreativeStyleCategory.RealEstate,
      education: CreativeStyleCategory.Education,
      healthcare: CreativeStyleCategory.Healthcare,
    };
    return map[style] ?? CreativeStyleCategory.Modern;
  }

  private buildCreativeStyle(
    brandVisual: BrandVisualIntelligenceRecord,
    override?: CreativeStyleCategory,
    analysisStyle?: string
  ): CreativeStylePlanning {
    const primary = override ?? this.mapBrandStyle(brandVisual.visualStyle);
    const secondary = this.inferSecondaryStyle(primary, brandVisual.profile.industry);

    return {
      primaryStyle: primary,
      secondaryStyle: secondary,
      styleDirection: `${primary} creative direction aligned with ${brandVisual.profile.visualTheme}`,
      typographyDirection: `${brandVisual.typography.primaryFont} headings, ${brandVisual.typography.secondaryFont} body`,
      colorDirection: `Primary palette ${brandVisual.profile.primaryColors.join(", ")} with ${brandVisual.profile.secondaryColors.join(", ")} accents`,
      moodDirection: brandVisual.profile.graphicStyle ?? analysisStyle ?? "commercial",
      graphicTreatment: brandVisual.planning.visualStylePlan ?? brandVisual.profile.graphicStyle,
    };
  }

  private inferSecondaryStyle(primary: CreativeStyleCategory, industry: string): CreativeStyleCategory {
    if (primary === CreativeStyleCategory.Technology) return CreativeStyleCategory.Modern;
    if (primary === CreativeStyleCategory.Fashion) return CreativeStyleCategory.Premium;
    if (primary === CreativeStyleCategory.Food) return CreativeStyleCategory.Restaurant;
    if (industry?.toLowerCase().includes("electronics")) return CreativeStyleCategory.Electronics;
    return CreativeStyleCategory.Minimal;
  }

  private buildLayoutPlanning(
    composition: CompositionIntelligenceRecord,
    brandVisual: BrandVisualIntelligenceRecord,
    layoutType: CreativeLayoutType,
    platform: CreativeImagePlatform
  ): LayoutPlanning {
    const hierarchy = composition.visualHierarchy;
    const placement = composition.productPlacement;

    return {
      layoutType,
      visualHierarchy: `Primary: ${hierarchy.readingFlow}; product priority ${hierarchy.productPriority}%, brand ${hierarchy.brandVisibility}%`,
      productPlacement: `${placement.productPosition} at ${placement.productScale} scale — ${placement.productEmphasis}`,
      logoPlacement: brandVisual.logoAnalysis.logoPosition ?? "top-left safe zone with brand margin",
      headlinePlacement: "upper third, left-aligned for LTR reading flow",
      subtitlePlacement: "below headline with 8–12% vertical spacing",
      ctaPlacement: hierarchy.ctaVisibility >= 60 ? "lower-right primary CTA zone" : "center-bottom CTA with contrast emphasis",
      contactInformationPlacement: "footer safe area — contact block bottom-left",
      qrCodePlacement: platform === CreativeImagePlatform.WhatsAppStatus ? "bottom-right corner" : "optional footer-right",
      safeAreas: this.safeAreasForPlatform(platform),
    };
  }

  private safeAreasForPlatform(platform: CreativeImagePlatform): string {
    const areas: Record<CreativeImagePlatform, string> = {
      [CreativeImagePlatform.InstagramPost]: "1:1 center safe — 5% margin all sides; avoid bottom 15% for UI overlay",
      [CreativeImagePlatform.InstagramStory]: "9:16 full bleed — top 14% and bottom 20% UI safe zones",
      [CreativeImagePlatform.InstagramReelCover]: "9:16 center crop — title in middle 60% vertical band",
      [CreativeImagePlatform.FacebookPost]: "1.91:1 link preview safe — text in center 80%",
      [CreativeImagePlatform.FacebookStory]: "9:16 story safe zones — top 250px, bottom 340px clear",
      [CreativeImagePlatform.TikTokCover]: "9:16 vertical — center focus, avoid edges for profile overlay",
      [CreativeImagePlatform.YouTubeThumbnail]: "16:9 — text left 40%, face/product right 60%; min 1280px",
      [CreativeImagePlatform.YouTubeCommunity]: "16:9 community post — centered headline, brand logo corner",
      [CreativeImagePlatform.WhatsAppStatus]: "9:16 mobile — large text, high contrast, minimal elements",
      [CreativeImagePlatform.WebsiteBanner]: "16:9 or 21:9 hero — left text block, right product visual",
    };
    return areas[platform];
  }

  private buildMarketingPreparation(
    understanding: ImageUnderstandingRecord,
    marketingType: MarketingLayoutType | undefined,
    product: string,
    brand: string
  ): MarketingPreparation {
    const goal = understanding.marketingGoal ?? "conversion";
    const type = marketingType ?? this.inferMarketingType(goal);

    return {
      promotionalLayout: `Plan promotional ${type} layout for ${product} — goal: ${goal}`,
      productShowcase: `Hero product placement with ${product} as focal element`,
      offerLayout: type === MarketingLayoutType.Offer ? "Plan offer callout with price/value highlight zone" : "Offer zone reserved in lower third if needed",
      discountLayout: type === MarketingLayoutType.Discount ? "Plan discount badge top-right with urgency copy" : "Discount badge placement prepared",
      launchCampaign: type === MarketingLayoutType.LaunchCampaign ? "Plan launch hero with NEW badge and announcement headline" : "Launch campaign layout structure prepared",
      seasonalCampaign: type === MarketingLayoutType.SeasonalCampaign ? "Plan seasonal visual theme integration" : "Seasonal campaign slots prepared",
      brandAwareness: `Plan brand awareness layout emphasizing ${brand} identity and recall`,
      leadGeneration: "Plan lead-gen CTA with form/QR placement in footer safe area",
    };
  }

  private inferMarketingType(goal: string): MarketingLayoutType {
    const map: Record<string, MarketingLayoutType> = {
      conversion: MarketingLayoutType.Promotional,
      awareness: MarketingLayoutType.BrandAwareness,
      engagement: MarketingLayoutType.ProductShowcase,
      retention: MarketingLayoutType.Offer,
      launch: MarketingLayoutType.LaunchCampaign,
      education: MarketingLayoutType.BrandAwareness,
    };
    return map[goal] ?? MarketingLayoutType.Promotional;
  }

  private buildPlatformPreparation(
    composition: CompositionIntelligenceRecord,
    brandVisual: BrandVisualIntelligenceRecord,
    enhancementPlan: ImageEnhancementPlanningRecord | null,
    targetPlatform: CreativeImagePlatform
  ): PlatformPreparation {
    const base = `Planning only — no graphics generated; brand ${brandVisual.profile.brandName}`;
    const enhance = enhancementPlan
      ? `; enhancement readiness ${enhancementPlan.scores.enhancementReadinessScore}%`
      : "";

    return {
      instagramPost: targetPlatform === CreativeImagePlatform.InstagramPost
        ? `${base}; square feed layout with product center${enhance}`
        : `${base}; 1:1 crop plan from composition balance ${composition.compositionAnalysis.balance}%`,
      instagramStory: `${base}; 9:16 vertical story layout plan`,
      instagramReelCover: `${base}; reel cover title zone middle band`,
      facebookPost: `${base}; 1.91:1 link preview layout plan`,
      facebookStory: `${base}; full-screen story layout with CTA bottom`,
      tiktokCover: targetPlatform === CreativeImagePlatform.TikTokCover
        ? `${base}; vertical cover with bold headline${enhance}`
        : `${base}; 9:16 TikTok cover planning`,
      youtubeThumbnail: `${base}; 16:9 thumbnail with high-contrast text overlay plan`,
      youtubeCommunity: `${base}; community post layout with brand header`,
      whatsappStatus: `${base}; mobile-first status with minimal text`,
      websiteBanner: targetPlatform === CreativeImagePlatform.WebsiteBanner
        ? `${base}; responsive hero banner layout${enhance}`
        : `${base}; website banner planning`,
    };
  }

  private buildProductionInstructions(
    layout: LayoutPlanning,
    style: CreativeStylePlanning,
    marketing: MarketingPreparation,
    platform: CreativeImagePlatform,
    brand: string
  ): CreativeProductionInstructions {
    return {
      headlineGuidance: `Headline in ${layout.headlinePlacement}; max 6 words for ${platform}`,
      subtitleGuidance: `Supporting copy in ${layout.subtitlePlacement}; 1–2 lines max`,
      ctaGuidance: `CTA at ${layout.ctaPlacement}; action-oriented, brand-aligned`,
      imageryGuidance: `Product at ${layout.productPlacement}; preserve source image integrity`,
      brandGuidance: `Apply ${style.primaryStyle} style; logo at ${layout.logoPlacement}; ${brand} palette`,
      platformGuidance: layout.safeAreas,
      productionNotes: `${marketing.promotionalLayout}; style: ${style.styleDirection}`,
    };
  }

  private buildRecommendations(
    layout: LayoutPlanning,
    style: CreativeStylePlanning,
    marketing: MarketingPreparation,
    brandVisual: BrandVisualIntelligenceRecord,
    composition: CompositionIntelligenceRecord,
    platform: CreativeImagePlatform
  ): CreativeImageRecommendation[] {
    const recs: CreativeImageRecommendation[] = [];

    if (composition.visualHierarchy.productPriority < 60) {
      recs.push({
        category: "layout",
        suggestion: "Increase product prominence in planned layout hierarchy",
        priority: "high",
        reason: `Product priority ${composition.visualHierarchy.productPriority}%`,
      });
    }
    if (brandVisual.scores.brandConsistencyScore < 75) {
      recs.push({
        category: "brand",
        suggestion: "Align planned layout with brand visual guidelines",
        priority: "high",
        reason: `Brand consistency ${brandVisual.scores.brandConsistencyScore}%`,
      });
    }
    if (composition.visualHierarchy.ctaVisibility < 55) {
      recs.push({
        category: "marketing",
        suggestion: marketing.leadGeneration,
        priority: "medium",
        reason: "CTA visibility below optimal threshold",
      });
    }
    recs.push({
      category: "style",
      suggestion: style.styleDirection,
      priority: "medium",
      reason: `${style.primaryStyle} creative style selected`,
    });
    recs.push({
      category: "platform",
      suggestion: `Platform layout prepared for ${platform}`,
      priority: "low",
      reason: layout.safeAreas.slice(0, 60),
    });
    recs.push({
      category: "production",
      suggestion: "Creative plan ready — no graphics generated, production instructions prepared",
      priority: "low",
      reason: "Planning-only mode — original image preserved",
    });

    return recs;
  }
}

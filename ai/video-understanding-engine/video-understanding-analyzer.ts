import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { VideoAnalysisType } from "../video-analysis-engine/types.js";
import {
  AudienceUnderstanding,
  BrandUnderstanding,
  MarketingUnderstanding,
  ProductUnderstanding,
  SceneRelationshipMap,
  StoryUnderstanding,
  VideoChapter,
  VideoContextUnderstanding,
  VideoIdentity,
  VideoPurpose,
  VideoSceneRole,
  VideoSceneUnderstanding,
  VideoSection,
  VideoStoryType,
  VideoStructureHierarchy,
  VideoUnderstandingMarketingGoal,
  VideoUnderstandingRecommendation,
} from "./types.js";

const STORY_BY_TYPE: Partial<Record<VideoAnalysisType, VideoStoryType>> = {
  [VideoAnalysisType.Advertisement]: VideoStoryType.Promotional,
  [VideoAnalysisType.Commercial]: VideoStoryType.Promotional,
  [VideoAnalysisType.ProductShowcase]: VideoStoryType.ProductDemo,
  [VideoAnalysisType.Tutorial]: VideoStoryType.Tutorial,
  [VideoAnalysisType.SocialMedia]: VideoStoryType.Lifestyle,
  [VideoAnalysisType.Documentary]: VideoStoryType.Documentary,
  [VideoAnalysisType.Presentation]: VideoStoryType.BrandStory,
  [VideoAnalysisType.Interview]: VideoStoryType.Testimonial,
  [VideoAnalysisType.Animation]: VideoStoryType.Promotional,
  [VideoAnalysisType.Corporate]: VideoStoryType.BrandStory,
};

export class VideoUnderstandingAnalyzer {
  buildFromAnalysis(
    analysis: VideoAnalysisIntelligenceRecord,
    marketingGoal: VideoUnderstandingMarketingGoal = VideoUnderstandingMarketingGoal.Conversion,
    storyType: VideoStoryType = VideoStoryType.Other,
    industry = "general"
  ): {
    identity: VideoIdentity;
    purpose: VideoPurpose;
    context: VideoContextUnderstanding;
    scenes: VideoSceneUnderstanding[];
    sceneRelationships: SceneRelationshipMap[];
    story: StoryUnderstanding;
    product: ProductUnderstanding;
    brand: BrandUnderstanding;
    audience: AudienceUnderstanding;
    marketing: MarketingUnderstanding;
    structure: VideoStructureHierarchy;
    recommendations: VideoUnderstandingRecommendation[];
    keywords: string[];
    resolvedStoryType: VideoStoryType;
  } {
    const brandName = analysis.relationships.relatedBrands[0] ?? "unknown-brand";
    const productName = analysis.relationships.relatedProducts[0] ?? "";
    const campaign = analysis.relationships.relatedCampaigns[0] ?? "";
    const resolvedStoryType = storyType !== VideoStoryType.Other
      ? storyType
      : STORY_BY_TYPE[analysis.classification.videoType] ?? VideoStoryType.Other;

    const identity: VideoIdentity = {
      videoId: analysis.videoId,
      videoName: analysis.technical.videoName,
      videoType: analysis.classification.videoType,
      analysisId: analysis.analysisId,
      visualSummary: `${analysis.classification.videoType} video with ${analysis.classification.creativeStyle} style, ${analysis.timeline.sceneCount} scenes`,
    };

    const purpose: VideoPurpose = {
      primaryPurpose: this.inferPrimaryPurpose(analysis, productName, brandName, marketingGoal),
      intendedUse: analysis.classification.useCase,
      creativeIntent: `Communicate ${analysis.classification.creativeStyle} ${analysis.classification.category} narrative`,
      whyThisVideoExists: `Support ${marketingGoal} goals for ${brandName} through ${analysis.classification.videoType}`,
    };

    const context: VideoContextUnderstanding = {
      videoContext: `${analysis.classification.subcategory} ${analysis.classification.videoType} in ${analysis.technical.resolution}`,
      marketingContext: campaign
        ? `Part of ${campaign} campaign targeting ${marketingGoal}`
        : `Aligned with ${marketingGoal} marketing objective`,
      creativeContext: `${analysis.classification.creativeStyle} direction with ${analysis.visual.dominantColors.join(", ")} palette`,
      productionContext: `Production readiness ${analysis.productionReadiness.productionReadiness}/100, ${analysis.timeline.shotCount} shots`,
      brandContext: `${brandName} brand narrative with ${analysis.visual.visualStability >= 75 ? "consistent" : "developing"} visual identity`,
    };

    const scenes = this.buildSceneUnderstanding(analysis);
    const sceneRelationships = this.buildSceneRelationships(scenes);
    const story = this.buildStoryUnderstanding(analysis, resolvedStoryType, marketingGoal, productName, brandName);
    const product = this.buildProductUnderstanding(analysis, productName);
    const brand = this.buildBrandUnderstanding(analysis, brandName);
    const audience = this.buildAudienceUnderstanding(analysis, industry, marketingGoal, resolvedStoryType);
    const marketing = this.buildMarketingUnderstanding(analysis, marketingGoal, productName, campaign);
    const structure = this.buildStructure(analysis, scenes);
    const recommendations = this.buildRecommendations(analysis, story, product, brand, marketing, audience);
    const keywords = [
      ...analysis.keywords,
      analysis.classification.videoType,
      analysis.classification.creativeStyle,
      resolvedStoryType,
      marketingGoal,
      industry,
      brandName,
      productName,
    ].filter(Boolean);

    return {
      identity,
      purpose,
      context,
      scenes,
      sceneRelationships,
      story,
      product,
      brand,
      audience,
      marketing,
      structure,
      recommendations,
      keywords,
      resolvedStoryType,
    };
  }

  private inferPrimaryPurpose(
    analysis: VideoAnalysisIntelligenceRecord,
    product: string,
    brand: string,
    goal: VideoUnderstandingMarketingGoal
  ): string {
    const type = analysis.classification.videoType;
    if (type === VideoAnalysisType.ProductShowcase && product) {
      return `Demonstrate ${product} capabilities for ${goal}`;
    }
    if (type === VideoAnalysisType.Tutorial) {
      return `Educate viewers on ${product || brand} through structured instruction`;
    }
    if (type === VideoAnalysisType.SocialMedia) {
      return `Drive ${goal} engagement for ${brand} on social platforms`;
    }
    if (type === VideoAnalysisType.Commercial || type === VideoAnalysisType.Advertisement) {
      return `Promote ${product || brand} to achieve ${goal} outcomes`;
    }
    return `Support ${analysis.classification.useCase} communication for ${brand}`;
  }

  private buildSceneUnderstanding(analysis: VideoAnalysisIntelligenceRecord): VideoSceneUnderstanding[] {
    const durationMs = analysis.technical.durationMs;
    const sceneSegments = analysis.timeline.segments.filter((s) => s.type === "scene");
    const roles: VideoSceneRole[] = [
      VideoSceneRole.Opening,
      VideoSceneRole.Hook,
      VideoSceneRole.MainContent,
      VideoSceneRole.ProductDemonstration,
      VideoSceneRole.Promotional,
      VideoSceneRole.Cta,
      VideoSceneRole.Ending,
    ];

    if (sceneSegments.length > 0) {
      return sceneSegments.map((seg, i) => {
        const role = this.assignSceneRole(i, sceneSegments.length, analysis);
        return {
          sceneId: seg.segmentId,
          role,
          label: seg.label,
          startMs: seg.startMs,
          endMs: seg.endMs,
          description: this.describeScene(role, analysis),
          importance: i === 0 || role === VideoSceneRole.Cta ? "primary" : i < 3 ? "secondary" : "supporting",
        };
      });
    }

    const sceneCount = Math.max(analysis.timeline.sceneCount, 3);
    const sceneDuration = durationMs > 0 ? Math.floor(durationMs / sceneCount) : 0;
    const scenes: VideoSceneUnderstanding[] = [];

    for (let i = 0; i < sceneCount; i++) {
      const role = this.assignSceneRole(i, sceneCount, analysis);
      scenes.push({
        sceneId: `scene-${i + 1}`,
        role,
        label: `Scene ${i + 1}`,
        startMs: i * sceneDuration,
        endMs: i === sceneCount - 1 ? durationMs : (i + 1) * sceneDuration,
        description: this.describeScene(role, analysis),
        importance: roles.includes(role) && (role === VideoSceneRole.Opening || role === VideoSceneRole.Cta)
          ? "primary"
          : i < 2
            ? "secondary"
            : "supporting",
      });
    }
    return scenes;
  }

  private assignSceneRole(
    index: number,
    total: number,
    analysis: VideoAnalysisIntelligenceRecord
  ): VideoSceneRole {
    if (index === 0) return VideoSceneRole.Opening;
    if (index === 1) return VideoSceneRole.Hook;
    if (index === total - 1) return VideoSceneRole.Ending;
    if (index === total - 2) return VideoSceneRole.Cta;

    const type = analysis.classification.videoType;
    if (
      type === VideoAnalysisType.ProductShowcase &&
      index === Math.floor(total / 2)
    ) {
      return VideoSceneRole.ProductDemonstration;
    }
    if (
      (type === VideoAnalysisType.Commercial || type === VideoAnalysisType.Advertisement) &&
      index >= total - 3
    ) {
      return VideoSceneRole.Promotional;
    }
    return VideoSceneRole.MainContent;
  }

  private describeScene(role: VideoSceneRole, analysis: VideoAnalysisIntelligenceRecord): string {
    const product = analysis.relationships.relatedProducts[0] ?? "the subject";
    const map: Record<VideoSceneRole, string> = {
      [VideoSceneRole.Opening]: `Establish context and visual tone for ${analysis.classification.videoType}`,
      [VideoSceneRole.Hook]: `Capture attention with compelling ${analysis.classification.creativeStyle} visuals`,
      [VideoSceneRole.MainContent]: `Deliver core message and narrative progression`,
      [VideoSceneRole.ProductDemonstration]: `Showcase ${product} features and benefits`,
      [VideoSceneRole.Promotional]: `Highlight offer and brand value proposition`,
      [VideoSceneRole.Cta]: `Drive viewer action with clear call-to-action opportunity`,
      [VideoSceneRole.Ending]: `Close narrative with brand reinforcement and resolution`,
    };
    return map[role];
  }

  private buildSceneRelationships(scenes: VideoSceneUnderstanding[]): SceneRelationshipMap[] {
    return scenes.map((scene, i) => ({
      sceneId: scene.sceneId,
      relatedSceneIds: [
        scenes[i - 1]?.sceneId,
        scenes[i + 1]?.sceneId,
      ].filter((id): id is string => Boolean(id)),
      relationshipType: i === 0 ? "sequence-start" : i === scenes.length - 1 ? "sequence-end" : "sequential",
    }));
  }

  private buildStoryUnderstanding(
    analysis: VideoAnalysisIntelligenceRecord,
    storyType: VideoStoryType,
    goal: VideoUnderstandingMarketingGoal,
    product: string,
    brand: string
  ): StoryUnderstanding {
    return {
      storyType,
      storyFlow: `${storyType.replace(/-/g, " ")} arc across ${analysis.timeline.sceneCount} scenes`,
      narrativeStructure: this.inferNarrativeStructure(analysis, storyType),
      emotionalJourney: analysis.visual.saturation >= 70 ? "energetic-to-resolved" : "informative-to-confident",
      informationFlow: `Progressive reveal from hook through ${analysis.timeline.shotCount} shots to conclusion`,
      viewerAttentionFlow: `Peak attention at hook and ${product ? "product demonstration" : "main content"} segments`,
      marketingJourney: `Awareness → interest → ${goal} through structured scene progression`,
    };
  }

  private inferNarrativeStructure(
    analysis: VideoAnalysisIntelligenceRecord,
    storyType: VideoStoryType
  ): string {
    if (storyType === VideoStoryType.ProblemSolution) return "problem-agitate-solution";
    if (storyType === VideoStoryType.Tutorial) return "intro-demonstration-practice-summary";
    if (storyType === VideoStoryType.ProductDemo) return "context-demo-benefits-cta";
    if (analysis.timeline.sceneCount <= 3) return "hook-content-cta";
    return "three-act-structure";
  }

  private buildProductUnderstanding(
    analysis: VideoAnalysisIntelligenceRecord,
    productName: string
  ): ProductUnderstanding {
    const hasProduct = Boolean(productName);
    const visibility = hasProduct
      ? Math.min(100, 55 + analysis.visual.sharpness * 0.25 + analysis.visual.visualStability * 0.15)
      : 25;

    return {
      mainProduct: productName || "none",
      secondaryProducts: analysis.relationships.relatedProducts.slice(1),
      productImportance: hasProduct ? "primary-focus" : "background",
      productVisibility: Math.round(visibility),
      productPresentation: hasProduct
        ? `${analysis.classification.subcategory} presentation with ${analysis.visual.sharpness >= 75 ? "high" : "moderate"} clarity`
        : "no product focus",
      productUsage: hasProduct
        ? `Demonstrates ${productName} in ${analysis.classification.useCase} context`
        : "brand-focused without product demonstration",
    };
  }

  private buildBrandUnderstanding(
    analysis: VideoAnalysisIntelligenceRecord,
    brandName: string
  ): BrandUnderstanding {
    const logoPresence =
      analysis.relationships.relatedBrands.length > 0 &&
      (analysis.classification.videoType === VideoAnalysisType.Corporate ||
        analysis.classification.videoType === VideoAnalysisType.Commercial);
    const visibility = brandName !== "unknown-brand"
      ? Math.min(100, 60 + analysis.visual.contrast * 0.2 + analysis.visual.visualStability * 0.15)
      : 30;

    return {
      brandIdentity: brandName,
      logoPresence,
      brandVisibility: Math.round(visibility),
      brandMessaging: `${brandName} communicated through ${analysis.classification.creativeStyle} ${analysis.classification.category} narrative`,
      brandConsistency: Math.min(100, analysis.scores.visualQualityScore + (logoPresence ? 8 : 0)),
    };
  }

  private buildAudienceUnderstanding(
    analysis: VideoAnalysisIntelligenceRecord,
    industry: string,
    goal: VideoUnderstandingMarketingGoal,
    storyType: VideoStoryType
  ): AudienceUnderstanding {
    const targetAudience = this.inferAudience(industry, analysis.classification.videoType);
    return {
      targetAudience,
      viewerInterest: `${storyType.replace(/-/g, " ")} content relevant to ${targetAudience}`,
      engagementOpportunity: analysis.timeline.sceneCount >= 3
        ? "Multi-scene narrative supports sustained engagement"
        : "Short-form hook drives immediate engagement",
      viewerRetentionOpportunity:
        analysis.technical.durationMs <= 60_000
          ? "Concise format optimizes completion rate"
          : "Chapter structure supports mid-video retention",
      conversionOpportunity: `Align ${goal} CTA at peak attention in final third`,
    };
  }

  private inferAudience(industry: string, videoType: string): string {
    if (industry === "technology") return "creative professionals and marketing teams";
    if (industry === "education") return "learners and training audiences";
    if (videoType === VideoAnalysisType.SocialMedia) return "social media consumers";
    if (videoType === VideoAnalysisType.Corporate) return "business stakeholders";
    return "general audience";
  }

  private buildMarketingUnderstanding(
    analysis: VideoAnalysisIntelligenceRecord,
    goal: VideoUnderstandingMarketingGoal,
    product: string,
    campaign: string
  ): MarketingUnderstanding {
    let strength = 55;
    if (analysis.productionReadiness.marketingReadiness >= 70) strength += 15;
    if (product) strength += 10;
    if (campaign) strength += 10;
    if (analysis.audio.overallAudioQualityScore >= 75) strength += 5;
    strength = Math.min(100, strength);

    return {
      campaignGoal: campaign ? `${campaign}: ${goal}` : `Achieve ${goal} through video marketing`,
      offerPresentation: product
        ? `Present ${product} value proposition across ${analysis.timeline.sceneCount} scenes`
        : `Brand-led offer presentation for ${goal}`,
      productBenefits: product
        ? `Highlight ${product} capabilities, quality and use-case fit`
        : "Emphasize brand trust and category leadership",
      ctaOpportunity:
        analysis.classification.videoType === VideoAnalysisType.Commercial ||
        analysis.classification.videoType === VideoAnalysisType.Advertisement
          ? "Strong end-card CTA with offer reinforcement"
          : "Subtle CTA integration in closing scene",
      marketingStrength: strength,
    };
  }

  private buildStructure(
    analysis: VideoAnalysisIntelligenceRecord,
    scenes: VideoSceneUnderstanding[]
  ): VideoStructureHierarchy {
    const durationMs = analysis.technical.durationMs;
    const third = Math.floor(durationMs / 3);

    const chapters: VideoChapter[] = [
      {
        chapterId: "chapter-intro",
        title: "Introduction",
        startMs: 0,
        endMs: third,
        sectionIds: ["section-opening"],
      },
      {
        chapterId: "chapter-body",
        title: "Main Content",
        startMs: third,
        endMs: third * 2,
        sectionIds: ["section-body"],
      },
      {
        chapterId: "chapter-close",
        title: "Conclusion",
        startMs: third * 2,
        endMs: durationMs,
        sectionIds: ["section-closing"],
      },
    ];

    const sections: VideoSection[] = [
      {
        sectionId: "section-opening",
        title: "Opening",
        startMs: 0,
        endMs: third,
        sceneIds: scenes.filter((s) => s.startMs < third).map((s) => s.sceneId),
      },
      {
        sectionId: "section-body",
        title: "Body",
        startMs: third,
        endMs: third * 2,
        sceneIds: scenes.filter((s) => s.startMs >= third && s.endMs <= third * 2).map((s) => s.sceneId),
      },
      {
        sectionId: "section-closing",
        title: "Closing",
        startMs: third * 2,
        endMs: durationMs,
        sceneIds: scenes.filter((s) => s.endMs > third * 2).map((s) => s.sceneId),
      },
    ];

    return {
      chapters,
      sections,
      sceneHierarchy: scenes.map((s) => `${s.sceneId}:${s.role}`),
      timelineHierarchy: analysis.timeline.segments.map((s) => `${s.segmentId}:${s.type}`),
      storyHierarchy: ["hook", "development", "climax", "resolution"],
    };
  }

  private buildRecommendations(
    analysis: VideoAnalysisIntelligenceRecord,
    story: StoryUnderstanding,
    product: ProductUnderstanding,
    brand: BrandUnderstanding,
    marketing: MarketingUnderstanding,
    audience: AudienceUnderstanding
  ): VideoUnderstandingRecommendation[] {
    const recs: VideoUnderstandingRecommendation[] = [];

    if (product.productVisibility < 70 && product.mainProduct !== "none") {
      recs.push({
        category: "product",
        suggestion: "Increase product screen time in main content scenes",
        priority: "high",
        reason: `Product visibility at ${product.productVisibility}%`,
      });
    }
    if (!brand.logoPresence && brand.brandIdentity !== "unknown-brand") {
      recs.push({
        category: "brand",
        suggestion: "Add brand logo overlay in opening and closing scenes",
        priority: "medium",
        reason: "Logo presence not detected in brand communication",
      });
    }
    if (marketing.marketingStrength < 75) {
      recs.push({
        category: "marketing",
        suggestion: marketing.ctaOpportunity,
        priority: "high",
        reason: `Marketing strength ${marketing.marketingStrength}/100`,
      });
    }
    if (analysis.timeline.sceneCount < 3) {
      recs.push({
        category: "story",
        suggestion: "Expand scene count for richer narrative structure",
        priority: "medium",
        reason: "Limited scene diversity reduces storytelling depth",
      });
    }
    if (analysis.productionReadiness.productionReadiness < 75) {
      recs.push({
        category: "production",
        suggestion: "Complete technical validation before production handoff",
        priority: "medium",
        reason: `Production readiness ${analysis.productionReadiness.productionReadiness}/100`,
      });
    }
    recs.push({
      category: "audience",
      suggestion: audience.conversionOpportunity,
      priority: "low",
      reason: `Target: ${audience.targetAudience}`,
    });
    recs.push({
      category: "story",
      suggestion: `Leverage ${story.storyType} structure for script planning`,
      priority: "low",
      reason: "Story readiness for downstream production",
    });

    return recs;
  }
}

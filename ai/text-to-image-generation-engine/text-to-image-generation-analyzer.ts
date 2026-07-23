import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { CreativeDirectionStyle } from "../creative-direction-engine/types.js";
import {
  ALL_TEXT_TO_IMAGE_PLATFORMS,
  ColorPlan,
  CompositionPlan,
  ImageArtisticStyle,
  ImagePlanProfile,
  ImageVariation,
  ImageVariationType,
  LightingPlan,
  PLATFORM_CONFIG,
  PlatformImageOptimization,
  ProductImageType,
  ProductionImageInstructions,
  PromptAnalysis,
  StylePlan,
  TextToImageGenerationInput,
  TextToImagePlatform,
} from "./types.js";

export interface GenerationContext {
  productId?: string;
  productName?: string;
  brandName?: string;
  brandId?: string;
  brandGuidelines?: string;
  projectId?: string;
  campaignId?: string;
  targetAudience?: string;
  keyBenefit?: string;
  keyFeature?: string;
  industry?: string;
  textPrompt?: string;
  creativeStyle?: CreativeDirectionStyle;
  creative?: CreativeDirectionRecord | null;
  strategy?: MarketingStrategyRecord | null;
  understanding?: ProductUnderstandingRecord | null;
}

const INDUSTRY_STYLE_MAP: Record<string, ImageArtisticStyle> = {
  technology: ImageArtisticStyle.Corporate,
  software: ImageArtisticStyle.Commercial,
  fashion: ImageArtisticStyle.Fashion,
  beauty: ImageArtisticStyle.Luxury,
  food: ImageArtisticStyle.ProductPhotography,
  default: ImageArtisticStyle.Photorealistic,
};

export class TextToImageGenerationAnalyzer {
  analyzePrompt(input: TextToImageGenerationInput, context: GenerationContext): PromptAnalysis {
    const prompt = input.textPrompt ?? context.textPrompt ?? "";
    const product = context.productName ?? "primary subject";
    const brand = context.brandName ?? "brand";
    const industry = context.industry ?? "general";
    const style = input.style ?? this.resolveStyle(context, industry);

    const subject = this.extractSubject(prompt, product, input.productImageType);
    const environment = this.extractEnvironment(prompt, industry, input.productImageType);
    const objects = this.extractObjects(prompt, product, context.keyFeature);

    return {
      subject,
      environment,
      objects,
      mood: this.extractMood(prompt, context.creativeStyle),
      emotion: this.extractEmotion(prompt, context.targetAudience),
      cameraPerspective: this.extractCameraPerspective(input.productImageType, style),
      composition: this.extractCompositionHint(prompt, input.productImageType),
      lighting: this.extractLightingHint(style, input.productImageType),
      colorPalette: this.extractColorPalette(context, brand),
      artisticStyle: style,
    };
  }

  buildProfile(
    input: TextToImageGenerationInput,
    platform: TextToImagePlatform,
    version: number,
    context: GenerationContext,
    promptAnalysis: PromptAnalysis
  ): ImagePlanProfile {
    const productId = context.productId ?? input.productId ?? "unknown-product";
    const promptId = `prompt-${productId}-${platform}-v${version}`;
    const imagePlanId = `image-plan-${productId}-${platform}-v${version}`;

    return {
      imagePlanId,
      promptId,
      projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
      productId,
      brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
      platform,
      style: promptAnalysis.artisticStyle,
      version,
      language: input.language ?? "en",
      productImageType: input.productImageType ?? ProductImageType.HeroImage,
    };
  }

  buildCompositionPlan(
    promptAnalysis: PromptAnalysis,
    context: GenerationContext,
    input: TextToImageGenerationInput
  ): CompositionPlan {
    const product = context.productName ?? "product";
    const type = input.productImageType ?? ProductImageType.HeroImage;

    return {
      composition: promptAnalysis.composition ||
        `${type} composition with ${promptAnalysis.subject} as focal point using rule-of-thirds`,
      background: promptAnalysis.environment ||
        `Clean ${promptAnalysis.environment} backdrop supporting ${product} visibility`,
      foreground: `Foreground elements framing ${product} with depth cues and brand context`,
      subjectPlacement: type === ProductImageType.CloseUp || type === ProductImageType.DetailView
        ? "Center-weighted macro placement with tight crop"
        : "Primary subject positioned at upper-left intersection with breathing room",
      objectPlacement: promptAnalysis.objects.length > 0
        ? `Supporting objects: ${promptAnalysis.objects.join(", ")} arranged in secondary plane`
        : `Minimal supporting props aligned with ${context.industry ?? "product"} category`,
      cameraAngle: promptAnalysis.cameraPerspective,
      cameraDistance: type === ProductImageType.CloseUp ? "Macro close distance (15-30cm)"
        : type === ProductImageType.LifestyleImage ? "Medium-wide lifestyle distance (1.5-3m)"
        : "Standard product distance (60-90cm)",
      perspective: type === ProductImageType.PackagingView ? "Straight-on packaging perspective"
        : "Slight three-quarter perspective for dimensional depth",
    };
  }

  buildLightingPlan(promptAnalysis: PromptAnalysis, style: ImageArtisticStyle): LightingPlan {
    const isLuxury = style === ImageArtisticStyle.Luxury || style === ImageArtisticStyle.Fashion;
    const isProduct = style === ImageArtisticStyle.ProductPhotography || style === ImageArtisticStyle.Commercial;

    return {
      naturalLighting: isLuxury
        ? "Soft window light with warm golden hour quality"
        : "Balanced natural ambient fill for authentic feel",
      studioLighting: isProduct
        ? "Three-point studio setup: key softbox 45°, fill at 30%, hair light for separation"
        : "Controlled studio key with diffused fill and background separation",
      dramaticLighting: isLuxury
        ? "Low-key dramatic contrast with controlled shadow falloff"
        : "Moderate contrast with defined shadow edges for depth",
      rimLight: "Subtle rim light separating subject from background at 120° rear angle",
      softLight: "Primary diffused soft light for skin/product surface quality",
      hardLight: "Accent hard light for texture definition on key product features",
      hdrPreparation: "Exposure bracket preparation: -1 EV shadow detail, 0 EV base, +1 EV highlight recovery",
    };
  }

  buildStylePlan(
    promptAnalysis: PromptAnalysis,
    context: GenerationContext,
    input: TextToImageGenerationInput
  ): StylePlan {
    const brand = context.brandName ?? "brand";
    return {
      style: promptAnalysis.artisticStyle,
      styleNotes: `${promptAnalysis.artisticStyle} treatment with ${promptAnalysis.mood} mood and ${promptAnalysis.emotion} emotional tone`,
      referenceStyles: input.styleReferenceIds ?? [promptAnalysis.artisticStyle],
      brandAlignment: context.brandGuidelines ??
        input.brandGuidelines ??
        `Align visual language with ${brand} identity — ${promptAnalysis.artisticStyle} execution`,
    };
  }

  buildColorPlan(promptAnalysis: PromptAnalysis, context: GenerationContext): ColorPlan {
    const brand = context.brandName ?? "brand";
    const palette = promptAnalysis.colorPalette;

    return {
      primaryColors: palette.slice(0, 2).length >= 2 ? palette.slice(0, 2) : ["#1A1A2E", "#16213E"],
      accentColors: palette.slice(2, 4).length >= 1 ? palette.slice(2, 4) : ["#E94560", "#0F3460"],
      brandColors: [`${brand} primary palette`, ...palette.slice(0, 3)],
      contrast: promptAnalysis.artisticStyle === ImageArtisticStyle.Minimal ? "High contrast minimal palette"
        : "Balanced contrast with preserved highlight and shadow detail",
      saturation: promptAnalysis.artisticStyle === ImageArtisticStyle.Cartoon ? "Elevated saturation for illustrative pop"
        : "Natural saturation with brand-consistent color grading",
      whiteBalance: "5500K neutral daylight with subtle warm bias for commercial appeal",
    };
  }

  buildPlatformOptimizations(
    profile: ImagePlanProfile,
    input: TextToImageGenerationInput
  ): PlatformImageOptimization[] {
    const platforms = input.generatePlatformOptimizations !== false
      ? ALL_TEXT_TO_IMAGE_PLATFORMS
      : [profile.platform];

    return platforms.map((platform) => {
      const config = PLATFORM_CONFIG[platform];
      return {
        platform,
        aspectRatio: config.aspectRatio,
        resolution: config.resolution,
        safeZones: this.getSafeZones(platform),
        formatNotes: this.getFormatNotes(platform),
        optimizationNotes: [
          `Crop to ${config.aspectRatio} (${config.resolution})`,
          `Optimize for ${platform} viewing context`,
          profile.style === ImageArtisticStyle.ProductPhotography
            ? "Preserve product detail at platform resolution"
            : "Balance composition for platform safe zones",
        ],
      };
    });
  }

  buildVariations(profile: ImagePlanProfile, compositionPlan: CompositionPlan): ImageVariation[] {
    const base = profile.imagePlanId;
    return [
      {
        variationId: `${base}-var-a`,
        variationType: ImageVariationType.VariationA,
        label: "Variation A — Primary",
        compositionAdjustment: compositionPlan.composition,
        styleAdjustment: `${profile.style} baseline execution`,
        colorAdjustment: "Primary brand palette",
      },
      {
        variationId: `${base}-var-b`,
        variationType: ImageVariationType.VariationB,
        label: "Variation B — Style Shift",
        compositionAdjustment: "Alternate angle with shifted subject placement",
        styleAdjustment: ImageVariationType.StyleVariation,
        colorAdjustment: "Warm accent emphasis",
      },
      {
        variationId: `${base}-var-c`,
        variationType: ImageVariationType.VariationC,
        label: "Variation C — Composition Shift",
        compositionAdjustment: ImageVariationType.CompositionVariation,
        styleAdjustment: profile.style,
        colorAdjustment: ImageVariationType.ColorVariation,
      },
    ];
  }

  buildProductionInstructions(
    profile: ImagePlanProfile,
    compositionPlan: CompositionPlan,
    lightingPlan: LightingPlan
  ): ProductionImageInstructions {
    return {
      renderNotes: [
        `Execute ${profile.style} image plan for ${profile.platform}`,
        compositionPlan.composition,
        lightingPlan.studioLighting,
      ],
      layerGuidance: [
        "Background layer — environment and backdrop",
        "Midground layer — supporting objects and context",
        "Foreground layer — primary subject with mask refinement",
      ],
      maskGuidance: [
        "Subject isolation mask with feathered edges",
        "Background replacement mask for compositing",
      ],
      exportPreparation: [
        `Target resolution per ${profile.platform} optimization profile`,
        "Preserve non-destructive layer stack for future editing",
      ],
      qualityTargets: [
        "Sharp focus on primary subject",
        "Brand-consistent color grading",
        "Production-ready composition without crop artifacts",
      ],
    };
  }

  buildRecommendations(
    promptAnalysis: PromptAnalysis,
    compositionPlan: CompositionPlan,
    context: GenerationContext
  ): string[] {
    const recs: string[] = [];
    if (promptAnalysis.objects.length === 0) {
      recs.push("Consider adding contextual props to strengthen narrative");
    }
    if (context.brandName) {
      recs.push(`Ensure ${context.brandName} brand colors appear in accent elements`);
    }
    if (compositionPlan.cameraDistance.includes("Macro")) {
      recs.push("Verify texture detail visibility at export resolution");
    }
    recs.push("Review platform safe zones before final render preparation");
    return recs;
  }

  resolvePlatform(input: TextToImageGenerationInput, context: GenerationContext): TextToImagePlatform {
    if (input.platform) return input.platform;
    if (context.creative?.profile.platform === "instagram-reels") return TextToImagePlatform.Instagram;
    if (context.creative?.profile.platform === "tiktok") return TextToImagePlatform.TikTok;
    if (context.creative?.profile.platform === "facebook") return TextToImagePlatform.Facebook;
    if (context.creative?.profile.platform === "website") return TextToImagePlatform.Website;
    return TextToImagePlatform.Website;
  }

  resolveStyle(context: GenerationContext, industry: string): ImageArtisticStyle {
    if (context.creativeStyle === CreativeDirectionStyle.Luxury) return ImageArtisticStyle.Luxury;
    if (context.creativeStyle === CreativeDirectionStyle.ModernMinimal) return ImageArtisticStyle.Minimal;
    return INDUSTRY_STYLE_MAP[industry] ?? INDUSTRY_STYLE_MAP.default;
  }

  extractContextFromInput(input: TextToImageGenerationInput): GenerationContext {
    return {
      productId: input.productId,
      brandName: input.brandName,
      brandId: input.brandId,
      brandGuidelines: input.brandGuidelines,
      projectId: input.projectId,
      campaignId: input.campaignId,
      textPrompt: input.textPrompt,
      industry: "general",
    };
  }

  extractContextFromProduct(
    productId: string,
    productName: string,
    brandName: string,
    understanding?: ProductUnderstandingRecord | null,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    input?: TextToImageGenerationInput
  ): GenerationContext {
    return {
      productId,
      productName,
      brandName,
      brandId: input?.brandId ?? brandName,
      brandGuidelines: input?.brandGuidelines,
      projectId: input?.projectId ?? creative?.profile.projectId,
      campaignId: input?.campaignId ?? strategy?.relationships.campaigns[0],
      targetAudience: understanding?.customer.targetCustomer ?? creative?.profile.targetAudience,
      keyBenefit: understanding?.uniqueValue.keyBenefits[0],
      keyFeature: understanding?.uniqueValue.uniqueSellingPoints[0],
      industry: understanding?.customer.targetIndustry ?? "general",
      textPrompt: input?.textPrompt,
      creativeStyle: creative?.profile.creativeStyle,
      creative,
      strategy,
      understanding,
    };
  }

  private extractSubject(prompt: string, product: string, type?: ProductImageType): string {
    if (prompt.length >= 20) return prompt.slice(0, 120);
    if (type === ProductImageType.HeroImage) return `${product} hero shot — primary product focal point`;
    if (type === ProductImageType.LifestyleImage) return `${product} in authentic lifestyle context`;
    return `${product} as primary visual subject`;
  }

  private extractEnvironment(prompt: string, industry: string, type?: ProductImageType): string {
    if (prompt.toLowerCase().includes("studio")) return "Professional studio environment";
    if (type === ProductImageType.LifestyleImage) return `Real-world ${industry} lifestyle setting`;
    return `Clean ${industry}-appropriate environment with controlled backdrop`;
  }

  private extractObjects(prompt: string, product: string, feature?: string): string[] {
    const objects: string[] = [product];
    if (feature) objects.push(feature);
    if (prompt.toLowerCase().includes("packaging")) objects.push("product packaging");
    return [...new Set(objects)];
  }

  private extractMood(prompt: string, style?: CreativeDirectionStyle): string {
    if (prompt.toLowerCase().includes("dramatic")) return "dramatic";
    if (style === CreativeDirectionStyle.Luxury) return "premium";
    if (style === CreativeDirectionStyle.Lifestyle) return "energetic";
    return "professional";
  }

  private extractEmotion(prompt: string, audience?: string): string {
    if (prompt.toLowerCase().includes("inspire")) return "inspired";
    if (audience?.toLowerCase().includes("professional")) return "confident";
    return "trustworthy";
  }

  private extractCameraPerspective(type?: ProductImageType, style?: ImageArtisticStyle): string {
    if (type === ProductImageType.CloseUp || type === ProductImageType.DetailView) return "Macro eye-level";
    if (type === ProductImageType.PackagingView) return "Straight-on frontal";
    if (style === ImageArtisticStyle.Fashion) return "Dynamic three-quarter fashion angle";
    return "Eye-level three-quarter product angle";
  }

  private extractCompositionHint(prompt: string, type?: ProductImageType): string {
    if (type === ProductImageType.HeroImage) return "Hero composition — subject dominant with negative space for copy";
    if (prompt.toLowerCase().includes("minimal")) return "Minimal centered composition with generous whitespace";
    return "Rule-of-thirds composition with balanced visual weight";
  }

  private extractLightingHint(style: ImageArtisticStyle, type?: ProductImageType): string {
    if (style === ImageArtisticStyle.Luxury) return "Soft luxury lighting with controlled highlights";
    if (type === ProductImageType.ProductShowcase) return "Even product showcase lighting";
    return "Balanced commercial lighting setup";
  }

  private extractColorPalette(context: GenerationContext, brand: string): string[] {
    const base = ["#FFFFFF", "#F5F5F5", "#333333"];
    if (context.industry === "beauty") return ["#FFE4E1", "#FFB6C1", "#8B4513", ...base];
    if (context.industry === "fashion") return ["#2C2C2C", "#C0C0C0", "#8B0000", ...base];
    if (context.industry === "technology") return ["#0066CC", "#003366", "#00CCFF", ...base];
    return [`${brand}-primary`, "#0066CC", "#FFFFFF", "#333333"];
  }

  private getSafeZones(platform: TextToImagePlatform): string[] {
    const map: Record<TextToImagePlatform, string[]> = {
      [TextToImagePlatform.Instagram]: ["Center 80% safe for feed crop", "Avoid critical content in corners"],
      [TextToImagePlatform.TikTok]: ["Top 15% and bottom 20% UI overlay zones"],
      [TextToImagePlatform.Facebook]: ["Text overlay limit — keep copy in lower third"],
      [TextToImagePlatform.LinkedIn]: ["Professional tone — minimal text in image"],
      [TextToImagePlatform.Website]: ["Hero safe zone — center-left for headline overlay"],
      [TextToImagePlatform.Mobile]: ["Thumb-zone friendly — key content in center 60%"],
      [TextToImagePlatform.Print]: ["Bleed margin 3mm on all edges"],
      [TextToImagePlatform.Billboard]: ["High contrast — readable at 50m distance"],
    };
    return map[platform];
  }

  private getFormatNotes(platform: TextToImagePlatform): string[] {
    return [
      `Optimized for ${platform}`,
      `Resolution: ${PLATFORM_CONFIG[platform].resolution}`,
      `Aspect ratio: ${PLATFORM_CONFIG[platform].aspectRatio}`,
    ];
  }
}

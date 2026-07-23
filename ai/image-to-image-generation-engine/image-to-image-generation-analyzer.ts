import {
  BackgroundPlan,
  ImageTransformationBackgroundType,
  ImageToImageGenerationInput,
  ImageToImagePlatform,
  ImageTransformationStyle,
  ImageTransformationVariationType,
  MaskPlan,
  MaskType,
  PLATFORM_CONFIG,
  PreservationPlan,
  PreservationRule,
  SourceImageAnalysis,
  SourceImageCategory,
  SourceImageMetadata,
  TransformationPlan,
  TransformationPlanProfile,
  TransformationStep,
  TransformationType,
  TransformationVariation,
  PlatformTransformationOptimization,
  ProductionTransformationInstructions,
  ALL_IMAGE_TO_IMAGE_PLATFORMS,
  ALL_TRANSFORMATION_TYPES,
  ALL_PRESERVATION_RULES,
} from "./types.js";
import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { TextToImageGenerationRecord } from "../text-to-image-generation-engine/types.js";

export interface TransformationContext {
  productId?: string;
  productName?: string;
  brandName?: string;
  brandId?: string;
  brandGuidelines?: string;
  projectId?: string;
  campaignId?: string;
  industry?: string;
  transformationPrompt?: string;
  sourceMetadata?: SourceImageMetadata;
  textToImagePlan?: TextToImageGenerationRecord | null;
  creative?: CreativeDirectionRecord | null;
  strategy?: MarketingStrategyRecord | null;
  understanding?: ProductUnderstandingRecord | null;
}

const CATEGORY_STYLE_MAP: Record<SourceImageCategory, ImageTransformationStyle> = {
  [SourceImageCategory.Product]: ImageTransformationStyle.ProductPhotography,
  [SourceImageCategory.Portrait]: ImageTransformationStyle.Commercial,
  [SourceImageCategory.Lifestyle]: ImageTransformationStyle.Photorealistic,
  [SourceImageCategory.Packaging]: ImageTransformationStyle.ProductPhotography,
  [SourceImageCategory.Brand]: ImageTransformationStyle.Corporate,
};

export class ImageToImageGenerationAnalyzer {
  analyzeSourceImage(
    source: SourceImageMetadata,
    context: TransformationContext,
    textToImagePlan?: TextToImageGenerationRecord | null
  ): SourceImageAnalysis {
    const fromPlan = textToImagePlan?.promptAnalysis;
    return {
      subject: source.subject || fromPlan?.subject || context.productName || "primary subject",
      objects: source.objects ?? fromPlan?.objects ?? [source.subject],
      background: source.background ?? fromPlan?.environment ?? "neutral studio backdrop",
      composition: fromPlan?.composition ?? "rule-of-thirds balanced composition",
      lighting: fromPlan?.lighting ?? "even commercial lighting with soft shadows",
      colors: fromPlan?.colorPalette ?? ["#FFFFFF", "#333333", "#0066CC"],
      cameraPerspective: fromPlan?.cameraPerspective ?? "eye-level three-quarter angle",
      imageQuality: source.qualityScore >= 80 ? "high" : source.qualityScore >= 60 ? "good" : "acceptable",
      resolution: source.resolution,
      metadata: {
        width: source.width,
        height: source.height,
        format: source.format,
        category: source.category,
        qualityScore: source.qualityScore,
      },
    };
  }

  buildProfile(
    input: ImageToImageGenerationInput,
    source: SourceImageMetadata,
    platform: ImageToImagePlatform,
    version: number,
    context: TransformationContext
  ): TransformationPlanProfile {
    const productId = context.productId ?? input.productId ?? "unknown-product";
    const sourceId = source.imageId;
    const generatedImageId = `gen-image-${sourceId}-v${version}`;
    const transformationPlanId = `transform-plan-${sourceId}-${platform}-v${version}`;
    const promptId = `transform-prompt-${sourceId}-v${version}`;

    return {
      transformationPlanId,
      sourceImageId: sourceId,
      generatedImageId,
      promptId,
      projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
      productId,
      brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
      platform,
      targetStyle: input.targetStyle ?? CATEGORY_STYLE_MAP[source.category] ?? ImageTransformationStyle.Photorealistic,
      targetBackground: input.targetBackground ?? ImageTransformationBackgroundType.Studio,
      version,
      language: input.language ?? "en",
    };
  }

  buildTransformationPlan(
    input: ImageToImageGenerationInput,
    analysis: SourceImageAnalysis,
    profile: TransformationPlanProfile,
    context: TransformationContext
  ): TransformationPlan {
    const types = input.transformationTypes?.length
      ? input.transformationTypes
      : this.inferTransformationTypes(input, analysis);

    const steps: TransformationStep[] = types.map((type, index) => ({
      type,
      description: this.describeTransformation(type, analysis, profile, context),
      priority: index + 1,
      preserveElements: this.getPreserveElementsForType(type, analysis),
    }));

    return {
      steps,
      targetStyle: profile.targetStyle,
      targetBackground: profile.targetBackground,
      transformationPrompt:
        input.transformationPrompt ??
        context.transformationPrompt ??
        `Transform ${analysis.subject} to ${profile.targetStyle} with ${profile.targetBackground}`,
      visualConsistencyNotes: [
        `Maintain ${analysis.composition} structure during transformation`,
        `Preserve lighting character: ${analysis.lighting.slice(0, 60)}`,
        `Align output with ${profile.targetStyle} visual language`,
      ],
    };
  }

  buildPreservationPlan(input: ImageToImageGenerationInput, analysis: SourceImageAnalysis): PreservationPlan {
    const rules = input.preservationRules?.length ? input.preservationRules : [...ALL_PRESERVATION_RULES];

    return {
      rules,
      protectedRegions: [
        analysis.subject,
        ...analysis.objects.filter((o) => o !== analysis.subject).slice(0, 2),
      ],
      identityLock: rules.includes(PreservationRule.PreserveIdentity),
      brandColorLock: rules.includes(PreservationRule.PreserveBrandColors),
      compositionLock: rules.includes(PreservationRule.PreserveComposition),
      notes: rules.map((r) => this.preservationNote(r, analysis)),
    };
  }

  buildMaskPlan(profile: TransformationPlanProfile, analysis: SourceImageAnalysis): MaskPlan {
    const base = profile.sourceImageId;
    const masks = [
      {
        maskId: `${base}-editable`,
        maskType: MaskType.EditableMask,
        label: "Editable transformation region",
        region: "Non-protected transform areas",
        editable: true,
        protected: false,
      },
      {
        maskId: `${base}-protected`,
        maskType: MaskType.ProtectedMask,
        label: "Protected identity region",
        region: analysis.subject,
        editable: false,
        protected: true,
      },
      {
        maskId: `${base}-foreground`,
        maskType: MaskType.ForegroundMask,
        label: "Foreground subject mask",
        region: analysis.subject,
        editable: false,
        protected: true,
      },
      {
        maskId: `${base}-background`,
        maskType: MaskType.BackgroundMask,
        label: "Background replacement mask",
        region: analysis.background,
        editable: true,
        protected: false,
      },
      ...analysis.objects.slice(0, 2).map((obj, i) => ({
        maskId: `${base}-object-${i + 1}`,
        maskType: MaskType.ObjectMask,
        label: `Object mask: ${obj}`,
        region: obj,
        editable: i === 0,
        protected: i === 0,
      })),
      {
        maskId: `${base}-region-select`,
        maskType: MaskType.RegionSelection,
        label: "User-selected region",
        region: "Custom user-defined selection area",
        editable: true,
        protected: false,
      },
    ];

    return {
      masks,
      foregroundMaskId: `${base}-foreground`,
      backgroundMaskId: `${base}-background`,
      objectMaskIds: masks.filter((m) => m.maskType === MaskType.ObjectMask).map((m) => m.maskId),
      editableRegions: masks.filter((m) => m.editable).map((m) => m.region),
      protectedRegions: masks.filter((m) => m.protected).map((m) => m.region),
    };
  }

  buildBackgroundPlan(profile: TransformationPlanProfile, analysis: SourceImageAnalysis): BackgroundPlan {
    const plans: Record<ImageTransformationBackgroundType, BackgroundPlan> = {
      [ImageTransformationBackgroundType.White]: {
        backgroundType: ImageTransformationBackgroundType.White,
        description: "Pure white seamless background for e-commerce and catalog use",
        replacementStrategy: "Replace existing background with calibrated white (#FFFFFF)",
        lightingAdaptation: "Even wrap lighting to eliminate background shadows",
        colorHarmony: "Neutral white supporting accurate product color reproduction",
      },
      [ImageTransformationBackgroundType.Transparent]: {
        backgroundType: ImageTransformationBackgroundType.Transparent,
        description: "Alpha-transparent background for compositing workflows",
        replacementStrategy: "Extract subject via foreground mask, output PNG with alpha",
        lightingAdaptation: "Preserve edge lighting for clean alpha matting",
        colorHarmony: "No background color — subject colors remain unmodified",
      },
      [ImageTransformationBackgroundType.Studio]: {
        backgroundType: ImageTransformationBackgroundType.Studio,
        description: "Professional studio gradient backdrop",
        replacementStrategy: "Replace with controlled studio gradient matching product category",
        lightingAdaptation: "Studio key and fill adapted from source lighting analysis",
        colorHarmony: `Harmonize with source palette: ${analysis.colors.slice(0, 2).join(", ")}`,
      },
      [ImageTransformationBackgroundType.Lifestyle]: {
        backgroundType: ImageTransformationBackgroundType.Lifestyle,
        description: "Authentic lifestyle environment context",
        replacementStrategy: "Composite subject into contextual lifestyle scene",
        lightingAdaptation: "Match ambient lighting direction from lifestyle environment",
        colorHarmony: "Warm natural tones complementing product presentation",
      },
      [ImageTransformationBackgroundType.Outdoor]: {
        backgroundType: ImageTransformationBackgroundType.Outdoor,
        description: "Natural outdoor environment backdrop",
        replacementStrategy: "Place subject in outdoor setting with depth cues",
        lightingAdaptation: "Natural daylight simulation with environmental bounce",
        colorHarmony: "Earth tones and sky blues for natural integration",
      },
      [ImageTransformationBackgroundType.Custom]: {
        backgroundType: ImageTransformationBackgroundType.Custom,
        description: "Brand-custom background per guidelines",
        replacementStrategy: "Apply custom background per brand creative direction",
        lightingAdaptation: "Adapt lighting to custom background requirements",
        colorHarmony: "Brand-aligned color grading on background layer",
      },
    };

    return plans[profile.targetBackground];
  }

  buildPlatformOptimizations(
    profile: TransformationPlanProfile,
    input: ImageToImageGenerationInput
  ): PlatformTransformationOptimization[] {
    const platforms = input.generatePlatformOptimizations !== false
      ? ALL_IMAGE_TO_IMAGE_PLATFORMS
      : [profile.platform];

    return platforms.map((platform) => {
      const config = PLATFORM_CONFIG[platform];
      return {
        platform,
        aspectRatio: config.aspectRatio,
        resolution: config.resolution,
        safeZones: this.getSafeZones(platform),
        formatNotes: [`Resolution: ${config.resolution}`, `Aspect: ${config.aspectRatio}`],
        optimizationNotes: [
          `Transform and crop for ${platform}`,
          `Preserve identity during ${config.aspectRatio} adaptation`,
          profile.targetBackground === ImageTransformationBackgroundType.Transparent
            ? "Alpha channel preserved for compositing platforms"
            : "Background optimized for platform viewing context",
        ],
      };
    });
  }

  buildVariations(profile: TransformationPlanProfile): TransformationVariation[] {
    const base = profile.transformationPlanId;
    return [
      {
        variationId: `${base}-var-a`,
        variationType: ImageTransformationVariationType.VariationA,
        label: "Variation A — Primary transformation",
        styleAdjustment: `${profile.targetStyle} baseline`,
        backgroundAdjustment: profile.targetBackground,
        colorAdjustment: "Source color palette preserved",
      },
      {
        variationId: `${base}-var-b`,
        variationType: ImageTransformationVariationType.VariationB,
        label: "Variation B — Style shift",
        styleAdjustment: ImageTransformationVariationType.StyleVariation,
        backgroundAdjustment: profile.targetBackground,
        colorAdjustment: "Warm accent emphasis",
      },
      {
        variationId: `${base}-var-c`,
        variationType: ImageTransformationVariationType.VariationC,
        label: "Variation C — Background shift",
        styleAdjustment: profile.targetStyle,
        backgroundAdjustment: ImageTransformationVariationType.BackgroundVariation,
        colorAdjustment: ImageTransformationVariationType.ColorVariation,
      },
    ];
  }

  buildProductionInstructions(
    profile: TransformationPlanProfile,
    maskPlan: MaskPlan,
    transformationPlan: TransformationPlan
  ): ProductionTransformationInstructions {
    return {
      renderNotes: transformationPlan.steps.map((s) => s.description),
      maskGuidance: maskPlan.masks.map((m) => `${m.label}: ${m.region}`),
      layerGuidance: [
        "Source layer — original image preserved non-destructively",
        "Mask layer — editable and protected regions",
        "Transform layer — style and background modifications",
        "Output layer — platform-optimized export preparation",
      ],
      exportPreparation: [
        `Target resolution per ${profile.platform} profile`,
        "Non-destructive layer stack for undo/redo",
        "Identity preservation verified before export",
      ],
      qualityTargets: [
        "Identity preservation score >= 55",
        "No visible mask artifacts at export resolution",
        "Brand-consistent color grading applied",
      ],
    };
  }

  buildRecommendations(
    analysis: SourceImageAnalysis,
    preservationPlan: PreservationPlan,
    context: TransformationContext
  ): string[] {
    const recs: string[] = [];
    if (analysis.imageQuality === "acceptable") {
      recs.push("Consider subject enhancement before final transformation export");
    }
    if (preservationPlan.identityLock) {
      recs.push("Verify protected mask covers all identity-critical regions before transform");
    }
    if (context.brandName) {
      recs.push(`Ensure ${context.brandName} brand colors remain within tolerance after transformation`);
    }
    recs.push("Review platform safe zones after background replacement");
    return recs;
  }

  resolvePlatform(input: ImageToImageGenerationInput): ImageToImagePlatform {
    return input.platform ?? ImageToImagePlatform.Website;
  }

  resolveSourceMetadata(
    input: ImageToImageGenerationInput,
    context: TransformationContext
  ): SourceImageMetadata | null {
    if (input.sourceImageMetadata) return input.sourceImageMetadata;

    if (input.sourceImageId) {
      return {
        imageId: input.sourceImageId,
        category: SourceImageCategory.Product,
        subject: context.productName ?? context.textToImagePlan?.promptAnalysis.subject ?? "source subject",
        resolution: "1920x1080",
        width: 1920,
        height: 1080,
        format: "blueprint",
        qualityScore: 85,
        objects: context.textToImagePlan?.promptAnalysis.objects,
        background: context.textToImagePlan?.promptAnalysis.environment,
      };
    }

    if (context.textToImagePlan) {
      return {
        imageId: context.textToImagePlan.imagePlanId,
        category: this.inferCategory(context.industry),
        subject: context.textToImagePlan.promptAnalysis.subject,
        resolution: PLATFORM_CONFIG[ImageToImagePlatform.Website].resolution,
        width: 1920,
        height: 1080,
        format: "blueprint",
        qualityScore: 88,
        objects: context.textToImagePlan.promptAnalysis.objects,
        background: context.textToImagePlan.promptAnalysis.environment,
      };
    }

    return null;
  }

  extractContextFromInput(input: ImageToImageGenerationInput): TransformationContext {
    return {
      productId: input.productId,
      brandName: input.brandName,
      brandId: input.brandId,
      brandGuidelines: input.brandGuidelines,
      projectId: input.projectId,
      campaignId: input.campaignId,
      transformationPrompt: input.transformationPrompt,
      sourceMetadata: input.sourceImageMetadata,
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
    input?: ImageToImageGenerationInput,
    textToImagePlan?: TextToImageGenerationRecord | null
  ): TransformationContext {
    return {
      productId,
      productName,
      brandName,
      brandId: input?.brandId ?? brandName,
      brandGuidelines: input?.brandGuidelines,
      projectId: input?.projectId ?? creative?.profile.projectId,
      campaignId: input?.campaignId ?? strategy?.relationships.campaigns[0],
      industry: understanding?.customer.targetIndustry ?? "general",
      transformationPrompt: input?.transformationPrompt,
      textToImagePlan,
      creative,
      strategy,
      understanding,
    };
  }

  private inferTransformationTypes(
    input: ImageToImageGenerationInput,
    analysis: SourceImageAnalysis
  ): TransformationType[] {
    const types: TransformationType[] = [TransformationType.StyleTransfer];

    if (input.targetBackground && input.targetBackground !== ImageTransformationBackgroundType.Studio) {
      types.push(TransformationType.BackgroundReplacement);
    }
    if (input.transformationPrompt?.toLowerCase().includes("color")) {
      types.push(TransformationType.ColorModification);
    }
    if (input.transformationPrompt?.toLowerCase().includes("light")) {
      types.push(TransformationType.LightingAdjustment);
    }

    types.push(TransformationType.SubjectEnhancement, TransformationType.ResolutionPlanning);

    if (analysis.imageQuality === "acceptable") {
      types.push(TransformationType.SubjectEnhancement);
    }

    return [...new Set(types)].slice(0, ALL_TRANSFORMATION_TYPES.length);
  }

  private describeTransformation(
    type: TransformationType,
    analysis: SourceImageAnalysis,
    profile: TransformationPlanProfile,
    context: TransformationContext
  ): string {
    const map: Record<TransformationType, string> = {
      [TransformationType.StyleTransfer]: `Apply ${profile.targetStyle} style transfer to ${analysis.subject}`,
      [TransformationType.BackgroundReplacement]: `Replace ${analysis.background} with ${profile.targetBackground}`,
      [TransformationType.ColorModification]: `Adjust color palette while preserving brand colors for ${context.brandName ?? "brand"}`,
      [TransformationType.LightingAdjustment]: `Refine lighting from ${analysis.lighting.slice(0, 40)} for ${profile.targetStyle}`,
      [TransformationType.CompositionAdjustment]: `Adjust composition maintaining ${analysis.composition}`,
      [TransformationType.ObjectReplacement]: `Replace secondary objects in ${analysis.objects.join(", ")}`,
      [TransformationType.ObjectRemoval]: `Remove non-essential objects from background region`,
      [TransformationType.SubjectEnhancement]: `Enhance ${analysis.subject} detail and clarity`,
      [TransformationType.ResolutionPlanning]: `Plan upscaling from ${analysis.resolution} to platform target`,
    };
    return map[type];
  }

  private getPreserveElementsForType(type: TransformationType, analysis: SourceImageAnalysis): string[] {
    if (type === TransformationType.BackgroundReplacement) return [analysis.subject, ...analysis.objects.slice(0, 1)];
    if (type === TransformationType.StyleTransfer) return [analysis.subject, "brand logo", "product shape"];
    return [analysis.subject];
  }

  private preservationNote(rule: PreservationRule, analysis: SourceImageAnalysis): string {
    const map: Record<PreservationRule, string> = {
      [PreservationRule.PreserveIdentity]: `Lock identity features of ${analysis.subject}`,
      [PreservationRule.PreserveProductShape]: "Maintain exact product silhouette and proportions",
      [PreservationRule.PreserveLogo]: "Protect all logo and brand mark regions",
      [PreservationRule.PreserveBrandColors]: `Preserve brand colors: ${analysis.colors.slice(0, 2).join(", ")}`,
      [PreservationRule.PreserveComposition]: `Maintain ${analysis.composition}`,
      [PreservationRule.PreserveUserSelectedAreas]: "Honor user-selected protected regions",
    };
    return map[rule];
  }

  private inferCategory(industry?: string): SourceImageCategory {
    if (industry === "fashion") return SourceImageCategory.Lifestyle;
    if (industry === "beauty") return SourceImageCategory.Product;
    if (industry === "technology") return SourceImageCategory.Brand;
    return SourceImageCategory.Product;
  }

  private getSafeZones(platform: ImageToImagePlatform): string[] {
    const map: Record<ImageToImagePlatform, string[]> = {
      [ImageToImagePlatform.Instagram]: ["Center 80% safe for feed crop"],
      [ImageToImagePlatform.TikTok]: ["Top 15% and bottom 20% UI overlay zones"],
      [ImageToImagePlatform.Facebook]: ["Text overlay limit — lower third safe"],
      [ImageToImagePlatform.LinkedIn]: ["Professional tone — minimal overlay"],
      [ImageToImagePlatform.Website]: ["Hero safe zone — center-left for headline"],
      [ImageToImagePlatform.Print]: ["Bleed margin 3mm on all edges"],
      [ImageToImagePlatform.Billboard]: ["High contrast — readable at 50m"],
      [ImageToImagePlatform.Packaging]: ["Die-cut safe zone — 5mm from edges"],
    };
    return map[platform];
  }
}

import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { BackgroundGenerationRecord } from "../background-generation-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import {
  ALL_IMAGE_EDIT_GEN_PLATFORMS,
  ALL_IMAGE_EDIT_IDENTITY_TARGETS,
  ALL_IMAGE_EDIT_MASK_TYPES,
  ALL_IMAGE_EDIT_OPERATIONS,
  IdentityPreservationPlan,
  ImageAnalysisPlan,
  ImageEditGenPlatform,
  ImageEditIdentityTarget,
  ImageEditInpaintingType,
  ImageEditMaskType,
  ImageEditOperationType,
  ImageEditOutpaintingType,
  ImageEditPlatformOptimization,
  ImageEditQualityImprovementPlan,
  ImageEditingInput,
  ImageEditingPlanProfile,
  ImageEditOperationPlan,
  InpaintingPlan,
  MaskManagementPlan,
  NonDestructiveEditingPlan,
  OutpaintingPlan,
  ProductionImageEditingInstructions,
  IMAGE_EDIT_PLATFORM_CONFIG,
} from "./types.js";

export interface ImageEditingContext {
  productId?: string;
  productName?: string;
  brandName?: string;
  brandId?: string;
  brandGuidelines?: string;
  projectId?: string;
  campaignId?: string;
  industry?: string;
  editingPrompt?: string;
  sourceImageId?: string;
  productImagePlan?: ProductImageGenerationRecord | null;
  backgroundPlan?: BackgroundGenerationRecord | null;
  creative?: CreativeDirectionRecord | null;
  strategy?: MarketingStrategyRecord | null;
  understanding?: ProductUnderstandingRecord | null;
  analysis?: ProductAnalysisIntelligenceRecord | null;
}

const INDUSTRY_OPERATION_MAP: Record<string, ImageEditOperationType> = {
  technology: ImageEditOperationType.ProductCleanup,
  software: ImageEditOperationType.ProductCleanup,
  fashion: ImageEditOperationType.ColorEditing,
  beauty: ImageEditOperationType.SkinRetouchPlanning,
  food: ImageEditOperationType.ObjectRemoval,
  default: ImageEditOperationType.ObjectReplacement,
};

export class ImageEditingAnalyzer {
  analyzeImage(context: ImageEditingContext, input: ImageEditingInput): ImageAnalysisPlan {
    const subject = context.productName ?? "primary subject";
    return {
      subject: `${subject} as focal element with preserved identity`,
      objects: [
        subject,
        "supporting props",
        "background elements",
        ...(context.productImagePlan ? ["product packaging"] : []),
      ],
      background: context.backgroundPlan?.backgroundAnalysis.sceneEnvironment ?? "Studio or contextual environment",
      composition: "Rule-of-thirds alignment with subject as visual anchor",
      perspective: "Eye-level perspective with consistent vanishing points",
      lighting: context.backgroundPlan?.backgroundAnalysis.lightingDirection ?? "Key light upper-left at 45°",
      shadows: context.backgroundPlan?.backgroundAnalysis.shadowDirection ?? "Shadow lower-right matching key light",
      reflections: "Specular highlights on reflective surfaces mapped to light sources",
      imageQuality: "Commercial-grade resolution with minimal compression artifacts",
      resolution: context.productImagePlan?.profile.platform
        ? `Optimized for ${context.productImagePlan.profile.platform}`
        : "3000x2000 minimum for professional editing workflow",
    };
  }

  buildProfile(
    input: ImageEditingInput,
    platform: ImageEditGenPlatform,
    version: number,
    context: ImageEditingContext,
    sourceImageId: string
  ): ImageEditingPlanProfile {
    const productId = context.productId ?? input.productId ?? "unknown-product";
    const primaryOperation =
      input.primaryOperation ??
      input.operations?.[0] ??
      INDUSTRY_OPERATION_MAP[context.industry ?? "default"] ??
      ImageEditOperationType.ObjectReplacement;

    return {
      imageEditingPlanId: `edit-plan-${sourceImageId}-${platform}-v${version}`,
      sourceImageId,
      editedImageId: `edited-${sourceImageId}-v${version}`,
      promptId: `edit-prompt-${sourceImageId}-v${version}`,
      projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
      productId,
      brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
      campaignId: input.campaignId ?? context.campaignId ?? `campaign-${productId}`,
      platform,
      primaryOperation,
      inpaintingType: input.inpaintingType,
      outpaintingType: input.outpaintingType,
      version,
      language: input.language ?? "en",
    };
  }

  buildEditingOperations(
    input: ImageEditingInput,
    profile: ImageEditingPlanProfile,
    context: ImageEditingContext
  ): ImageEditOperationPlan {
    const operations = input.operations?.length
      ? input.operations
      : [profile.primaryOperation, ImageEditOperationType.ProductCleanup];

    const prompt =
      input.editingPrompt ??
      context.editingPrompt ??
      `Professional image editing — ${profile.primaryOperation} for ${context.productName ?? "subject"} preserving brand integrity`;

    const operationPrompts: Record<string, string> = {};
    for (const op of operations) {
      operationPrompts[op] = `${prompt} — ${op.replace(/-/g, " ")}`;
    }

    return {
      operations,
      operationPrompts,
      executionOrder: operations.map((op, i) => `${i + 1}. ${op}`),
      nonDestructiveNotes: [
        "All edits applied as non-destructive layers",
        "Original source preserved in version history",
        "Protected regions excluded from destructive operations",
      ],
    };
  }

  buildInpaintingPlan(input: ImageEditingInput, profile: ImageEditingPlanProfile): InpaintingPlan {
    const type = input.inpaintingType ?? ImageEditInpaintingType.MissingAreaReconstruction;
    return {
      inpaintingType: type,
      targetRegions: ["damaged areas", "removed object regions", "mask-defined holes"],
      reconstructionStrategy: `Inpaint using ${type} with texture and pattern continuity`,
      textureNotes: [
        "Match surrounding texture grain and direction",
        "Preserve material properties of adjacent surfaces",
        "Blend inpainted region with feathered edges",
      ],
      detailRecoveryNotes: [
        "Recover fine details lost in damaged regions",
        "Maintain consistent noise profile across inpainted area",
        "Validate edge continuity at mask boundaries",
      ],
    };
  }

  buildOutpaintingPlan(input: ImageEditingInput, profile: ImageEditingPlanProfile): OutpaintingPlan {
    const type = input.outpaintingType ?? ImageEditOutpaintingType.CanvasExpansion;
    const config = IMAGE_EDIT_PLATFORM_CONFIG[profile.platform];
    return {
      outpaintingType: type,
      expansionDirection: type === ImageEditOutpaintingType.AspectRatioExpansion ? "horizontal and vertical" : "context-aware",
      expansionRatio: `Target ${config.aspectRatio} (${config.resolution})`,
      sceneExtensionNotes: [
        "Extend scene geometry with consistent perspective",
        "Match lighting and atmospheric conditions of original",
        "Preserve subject placement within expanded canvas",
      ],
      environmentNotes: [
        `Environment extension for ${profile.platform} delivery`,
        "Seamless blend at original canvas boundaries",
        "No visible repetition artifacts in extended regions",
      ],
    };
  }

  buildMaskManagement(input: ImageEditingInput, context: ImageEditingContext): MaskManagementPlan {
    const subject = context.productName ?? "subject";
    const inputMasks = input.maskIds ?? [];
    const masks = ALL_IMAGE_EDIT_MASK_TYPES.map((maskType, index) => ({
      maskId: inputMasks[index] ?? `mask-${maskType}-${context.productId ?? "edit"}`,
      maskType,
      label: this.maskLabel(maskType, subject),
      editable: maskType !== ImageEditMaskType.ProtectedRegion,
      protected: maskType === ImageEditMaskType.ProtectedRegion || maskType === ImageEditMaskType.SubjectMask,
    }));

    return {
      masks,
      protectedRegions: [subject, "logo region", "brand marks", "packaging artwork"],
      layerNotes: [
        "Subject mask locked during background edits",
        "Editable masks support iterative refinement",
        "Layer masks enable selective adjustment stacking",
      ],
    };
  }

  buildIdentityPreservation(context: ImageEditingContext): IdentityPreservationPlan {
    const subject = context.productName ?? "primary subject";
    return {
      targets: [...ALL_IMAGE_EDIT_IDENTITY_TARGETS],
      identityLock: true,
      productLock: true,
      logoLock: true,
      brandColorLock: true,
      notes: ALL_IMAGE_EDIT_IDENTITY_TARGETS.map((t) => this.identityNote(t, subject, context.brandName)),
    };
  }

  buildNonDestructiveEditing(profile: ImageEditingPlanProfile, existing?: { version: number } | null): NonDestructiveEditingPlan {
    const version = profile.version;
    const history = [];
    for (let v = 1; v <= version; v++) {
      history.push({
        version: v,
        timestamp: new Date().toISOString(),
        summary: v === version ? `Current edit — ${profile.primaryOperation}` : `Prior edit version ${v}`,
      });
    }
    if (existing && version > 1) {
      history.unshift({
        version: 0,
        timestamp: new Date().toISOString(),
        summary: "Original source preserved",
      });
    }

    return {
      originalPreserved: true,
      layerEditingEnabled: true,
      undoStackDepth: Math.min(version, 10),
      redoStackDepth: 0,
      rollbackSupported: true,
      versionHistory: history,
    };
  }

  buildQualityImprovement(context: ImageEditingContext): ImageEditQualityImprovementPlan {
    return {
      edgeQuality: "Feathered mask edges at 2px with anti-aliasing for natural transitions",
      textureQuality: "Texture synthesis matched to surrounding regions during inpainting",
      fineDetails: "Micro-detail retention on product labels, hair strands, and fabric weave",
      noiseReduction: "Adaptive noise reduction preserving detail in subject regions",
      artifactPrevention: "Compression artifact suppression in edited and expanded regions",
      sharpnessPlanning: `Selective sharpening on ${context.productName ?? "subject"} with background softening`,
    };
  }

  buildPlatformOptimizations(
    profile: ImageEditingPlanProfile,
    input: ImageEditingInput
  ): ImageEditPlatformOptimization[] {
    const platforms = input.generatePlatformOptimizations !== false
      ? ALL_IMAGE_EDIT_GEN_PLATFORMS
      : [profile.platform];

    return platforms.map((platform) => {
      const config = IMAGE_EDIT_PLATFORM_CONFIG[platform];
      return {
        platform,
        aspectRatio: config.aspectRatio,
        resolution: config.resolution,
        optimizationNotes: [
          `Edited image optimized for ${platform}`,
          `Resolution ${config.resolution} with identity preservation verified`,
          profile.primaryOperation === ImageEditOperationType.ProductCleanup
            ? "Product cleanup validated for marketplace compliance"
            : "Editing quality validated for platform delivery",
        ],
      };
    });
  }

  buildProductionInstructions(
    profile: ImageEditingPlanProfile,
    operations: ImageEditOperationPlan,
    maskManagement: MaskManagementPlan
  ): ProductionImageEditingInstructions {
    return {
      renderNotes: Object.values(operations.operationPrompts),
      maskGuidance: maskManagement.masks.map((m) => `${m.label}: ${m.editable ? "editable" : "locked"}`),
      layerGuidance: [
        "Non-destructive layer stack: original → edits → adjustments",
        "Rollback to any version in history without data loss",
      ],
      exportPreparation: [
        `Target ${profile.platform} resolution per optimization profile`,
        "Layered export: original + edit layers + masks",
      ],
      qualityTargets: [
        "Identity preservation score >= 55",
        "No halo artifacts at edit boundaries",
        "Reconstruction quality consistent across inpainted regions",
      ],
    };
  }

  buildRecommendations(context: ImageEditingContext, analysis: ImageAnalysisPlan): string[] {
    const recs: string[] = [];
    recs.push("Verify mask boundaries before applying destructive edits");
    if (analysis.reflections.includes("reflective")) {
      recs.push("Review reflection consistency after lighting edits");
    }
    if (context.brandName) {
      recs.push(`Ensure ${context.brandName} brand elements remain untouched in protected regions`);
    }
    recs.push("Validate inpainting blend quality at region boundaries before export");
    return recs;
  }

  resolvePlatform(input: ImageEditingInput): ImageEditGenPlatform {
    return input.platform ?? ImageEditGenPlatform.Website;
  }

  resolveSourceImageId(input: ImageEditingInput, context: ImageEditingContext): string | null {
    if (input.sourceImageId) return input.sourceImageId;
    if (input.productImagePlanId) return input.productImagePlanId;
    if (input.backgroundPlanId) return input.backgroundPlanId;
    if (context.productImagePlan) return context.productImagePlan.productImagePlanId;
    if (context.backgroundPlan) return context.backgroundPlan.profile.sourceImageId;
    return null;
  }

  extractContextFromProduct(
    analysis: ProductAnalysisIntelligenceRecord | null,
    understanding: ProductUnderstandingRecord | null,
    creative: CreativeDirectionRecord | null,
    strategy: MarketingStrategyRecord | null,
    input: ImageEditingInput,
    productImagePlan?: ProductImageGenerationRecord | null,
    backgroundPlan?: BackgroundGenerationRecord | null
  ): ImageEditingContext | null {
    if (!analysis && !understanding && !productImagePlan && !backgroundPlan) return null;

    return {
      productId: input.productId,
      productName: analysis?.profile.productName ?? understanding?.identity.productName ?? input.productId,
      brandName: analysis?.profile.brand ?? understanding?.identity.brand ?? input.brandName ?? "Brand",
      brandId: input.brandId ?? analysis?.profile.brand ?? "unknown-brand",
      brandGuidelines: input.brandGuidelines,
      projectId: input.projectId ?? creative?.profile.projectId,
      campaignId: input.campaignId ?? strategy?.relationships.campaigns[0],
      industry: understanding?.customer.targetIndustry ?? analysis?.profile.category ?? "general",
      editingPrompt: input.editingPrompt,
      sourceImageId: input.sourceImageId,
      productImagePlan,
      backgroundPlan,
      creative,
      strategy,
      understanding,
      analysis,
    };
  }

  private maskLabel(type: ImageEditMaskType, subject: string): string {
    const map: Record<ImageEditMaskType, string> = {
      [ImageEditMaskType.EditableMask]: "General editable region",
      [ImageEditMaskType.ObjectMask]: "Object selection mask",
      [ImageEditMaskType.SubjectMask]: `${subject} subject protection mask`,
      [ImageEditMaskType.BackgroundMask]: "Background replacement mask",
      [ImageEditMaskType.LayerMask]: "Adjustment layer mask",
      [ImageEditMaskType.ProtectedRegion]: "Protected brand and identity region",
    };
    return map[type];
  }

  private identityNote(target: ImageEditIdentityTarget, subject: string, brand?: string): string {
    const map: Record<ImageEditIdentityTarget, string> = {
      [ImageEditIdentityTarget.HumanIdentity]: "Preserve facial features and body proportions if human subject present",
      [ImageEditIdentityTarget.ProductIdentity]: `Lock ${subject} shape, form, and identifying features during edits`,
      [ImageEditIdentityTarget.LogoIntegrity]: "Protect all logo and brand mark regions from editing operations",
      [ImageEditIdentityTarget.PackagingIntegrity]: "Maintain packaging artwork, labels, and box geometry exactly",
      [ImageEditIdentityTarget.BrandColors]: `${brand ?? "Brand"} color palette unchanged by color grading edits`,
      [ImageEditIdentityTarget.BrandElements]: "Brand typography, patterns, and visual elements remain intact",
    };
    return map[target];
  }
}

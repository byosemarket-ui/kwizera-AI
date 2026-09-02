/**
 * Builds a project-scoped intelligence context for the AI Creative Director.
 * Never includes unrelated projects — always bound to input.project.id.
 */
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import type { AiCreativePlannerInput } from "./ai-creative-planner.js";
import { buildVerifiedFactsContext, type VerifiedFactsContext } from "./verified-facts-context.js";

export interface ProjectIntelligenceContext {
  projectId: string;
  product: {
    name: string;
    category: string;
    description: string;
    price?: number;
    originalPrice?: number;
    currency?: string;
    features: string[];
    materials: string[];
    colours: string[];
  };
  marketing: {
    goal: string;
    audience: string;
    gender?: string;
    age?: string;
    location?: string;
    platform: string;
    durationSeconds: number;
    language: string;
    cta?: string;
    message?: string;
  };
  style: {
    productionMode: string;
    creativeTone?: string;
  };
  assets: Array<{
    assetId: string;
    fileName: string;
    viewRole?: string;
    qualityScore?: number;
    backgroundType?: string;
    preparationHint?: string;
    removableBackground?: boolean;
  }>;
  constraints: {
    mustUseOnlyAssetIds: string[];
    mustRespectProductionMode: true;
    mustMatchDurationSeconds: number;
    mustUseLanguage: string;
  };
  verifiedFacts: VerifiedFactsContext;
}

export function buildProjectIntelligenceContext(input: AiCreativePlannerInput): ProjectIntelligenceContext {
  const project = input.project;
  const originals = project.productImages.filter(isOriginalProductImage);
  const product = input.productIntelligence;
  const brief = input.marketingSettings;
  const commercial = input.commercial;

  const assets = originals.map((image) => {
    const profile = input.assets.find((item) => item.imageId === image.id);
    return {
      assetId: image.id,
      fileName: image.fileName,
      viewRole: profile?.viewRole,
      qualityScore: profile?.quality?.score,
      backgroundType: profile?.background?.type,
      preparationHint: profile?.background?.removalSuitability,
      removableBackground: profile?.background?.removable,
    };
  });

  return {
    projectId: project.id,
    product: {
      name: project.productInformation?.name
        || input.canonical?.identity.name
        || product?.productName
        || project.name,
      category: project.productInformation?.category
        || input.canonical?.identity.category
        || product?.category
        || "General",
      description: project.productInformation?.description
        || product?.description
        || "",
      price: project.productInformation?.price ?? commercial?.pricing.currentPrice ?? undefined,
      originalPrice: project.productInformation?.originalPrice ?? commercial?.pricing.originalPrice ?? undefined,
      currency: project.productInformation?.currency ?? commercial?.pricing.currency,
      features: [
        ...(product?.features ?? []),
        ...(input.canonical?.productFeatures ?? []),
      ].slice(0, 12),
      materials: product?.materials ?? input.canonical?.visualAnalysis?.materials ?? [],
      colours: product?.colours ?? input.canonical?.visualAnalysis?.colours ?? [],
    },
    marketing: {
      goal: input.videoSettings.objective,
      audience: brief?.campaign.audience.general
        || project.targetAudience
        || product?.customerIntelligence?.customerType
        || "general shoppers",
      gender: brief?.campaign.audience.gender,
      age: brief?.campaign.audience.ageRange,
      location: brief?.campaign.audience.location,
      platform: input.videoSettings.platform,
      durationSeconds: input.videoSettings.durationSeconds,
      language: input.videoSettings.language,
      cta: brief?.marketing.cta || project.campaignInformation?.callToAction,
      message: brief?.marketing.message || product?.valueProposition?.customerBenefit,
    },
    style: {
      productionMode: input.videoSettings.productionMode,
      creativeTone: input.videoSettings.creativeTone,
    },
    assets,
    constraints: {
      mustUseOnlyAssetIds: assets.map((item) => item.assetId),
      mustRespectProductionMode: true,
      mustMatchDurationSeconds: input.videoSettings.durationSeconds,
      mustUseLanguage: input.videoSettings.language,
    },
    verifiedFacts: buildVerifiedFactsContext(input),
  };
}

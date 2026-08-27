import type { StructuredProductProfile } from "./types.js";

export {
  PRODUCTION_STAGE_MAP,
  emptyProductionState,
  mapPipelineToProductionStages,
  parsePipelineError,
  pollPipelineJob,
  validateProductionOutput,
  persistProductionJob,
  loadProductionJob,
  startPipeline,
  fetchProductionArtifacts,
} from "../product-creation/production-orchestrator.js";

export function mergeStructuredProfile(
  intel: Record<string, unknown>,
  fields: {
    name: string;
    brand: string;
    model: string;
    sku: string;
    category: string;
    price: number | null;
    currency: string;
    description: string;
    shortDescription: string;
    features: string[];
    benefits: string[];
    materials: string[];
    colors: string[];
  },
): StructuredProductProfile {
  const uncertain: string[] = [];
  const asList = (value: unknown): string[] =>
    Array.isArray(value) ? value.map(String).filter(Boolean) : [];

  const aiBrand = String(intel.brand ?? "");
  const aiCategory = String(intel.category ?? "");
  const aiMaterials = asList(intel.materials);
  const aiColors = asList(intel.colours ?? intel.colors);
  const aiFeatures = asList(intel.features);
  const aiSelling = asList(intel.sellingPoints);
  const aiKeywords = asList(intel.marketingKeywords);
  const aiShapes = asList(intel.shapes);
  const aiTextures = asList(intel.textures);
  const aiLogos = asList(intel.visibleLogos);
  const missing = asList(intel.missingInformation);
  const quality = intel.quality as { score?: number; confidence?: number; notes?: string[] } | undefined;
  const multiView = intel.multiView as { missingAngles?: string[]; coverage?: string } | undefined;
  const imageAnalysis = intel.imageAnalysis as { missingAngles?: string[] } | undefined;

  if (!fields.brand.trim() && aiBrand && !/unknown|requires|not determined/i.test(aiBrand)) {
    uncertain.push("brand");
  }
  if (!fields.category.trim() && aiCategory) uncertain.push("category");
  if (!fields.materials.length && aiMaterials.some((m) => /verification|requires/i.test(m))) {
    uncertain.push("materials");
  }

  return {
    identity: {
      name: fields.name.trim() || String(intel.productName ?? "Product"),
      brand: fields.brand.trim() || (/unknown|requires|not determined/i.test(aiBrand) ? undefined : aiBrand || undefined),
      model: fields.model.trim() || undefined,
      sku: fields.sku.trim() || undefined,
      category: fields.category.trim() || aiCategory || undefined,
      productType: String(intel.productType ?? "") || undefined,
      price: fields.price ?? undefined,
      currency: fields.currency.trim() || undefined,
    },
    visual: {
      colors: fields.colors.length ? fields.colors : aiColors,
      materials: fields.materials.length ? fields.materials : aiMaterials.filter((m) => !/verification|requires/i.test(m)),
      shapes: aiShapes,
      textures: aiTextures,
      features: fields.features.length ? fields.features : aiFeatures,
      logos: aiLogos,
      style: String(intel.style ?? "") || undefined,
    },
    commercial: {
      sellingPoints: aiSelling.length ? aiSelling : fields.benefits.slice(0, 5),
      marketingKeywords: aiKeywords,
      targetAudience: String(intel.targetAudience ?? "") || undefined,
      description: fields.description.trim() || fields.shortDescription.trim() || String(intel.description ?? "") || undefined,
    },
    coverage: {
      viewCount: Number(intel.viewCount ?? 0),
      missingAngles: imageAnalysis?.missingAngles ?? multiView?.missingAngles ?? [],
      imageQualityScore: quality?.score,
      coverageLabel: multiView?.coverage ?? undefined,
    },
    confidence: {
      overall: Math.round((quality?.confidence ?? quality?.score ?? 65)),
      notes: quality?.notes ?? [],
    },
    missingInformation: missing,
    uncertainFields: uncertain,
    foundationKnowledgeIds: asList(intel.foundationKnowledgeIds),
    readyForCreativeGeneration: Boolean(intel.readyForCreativeGeneration),
    source: "merged",
    analyzedAt: new Date().toISOString(),
  };
}

export async function fetchProductionOutput(projectId: string): Promise<{
  outputUrl: string | null;
  version: string | null;
  quality: number | null;
}> {
  try {
    const response = await fetch(`/api/product-rendering-export?projectId=${encodeURIComponent(projectId)}`);
    if (!response.ok) return { outputUrl: null, version: null, quality: null };
    const body = await response.json() as {
      renders?: Array<{ version?: number; quality?: { overall?: number }; artifacts?: { previewRelativePath?: string } }>;
    };
    const latest = body.renders?.[0];
    if (!latest) return { outputUrl: null, version: null, quality: null };
    const previewPath = latest.artifacts?.previewRelativePath;
    return {
      outputUrl: previewPath
        ? `/api/product-rendering-export/projects/${encodeURIComponent(projectId)}/preview`
        : null,
      version: latest.version != null ? String(latest.version) : null,
      quality: latest.quality?.overall ?? null,
    };
  } catch {
    return { outputUrl: null, version: null, quality: null };
  }
}

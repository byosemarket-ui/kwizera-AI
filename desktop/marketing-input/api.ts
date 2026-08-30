import { openProjectApi, getProjectApi, updateProjectApi, type CreativeProjectDto } from "../product-intake/api";
import type { AuthoritativeBriefView, CanonicalProductSummary } from "./types";

export async function ensureProjectOpen(projectId: string): Promise<CreativeProjectDto> {
  try {
    return await openProjectApi(projectId);
  } catch {
    return getProjectApi(projectId);
  }
}

export async function persistMarketingProject(
  projectId: string,
  changes: Record<string, unknown>,
): Promise<CreativeProjectDto> {
  return updateProjectApi(projectId, changes);
}

export async function fetchMarketingIntelligence(projectId: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`/api/marketing-intelligence/projects/${projectId}/analyze`, { method: "POST" });
    if (!response.ok) return null;
    const body = await response.json() as { profile?: Record<string, unknown> };
    return body.profile ?? null;
  } catch {
    return null;
  }
}

export async function fetchCanonicalProduct(projectId: string): Promise<CanonicalProductSummary | null> {
  try {
    const response = await fetch(`/api/product-record/projects/${encodeURIComponent(projectId)}`);
    if (!response.ok) return null;
    const body = await response.json() as { product?: Record<string, unknown> };
    const product = body.product;
    if (!product) return null;
    const identity = (product.identity ?? {}) as Record<string, string>;
    const originals = Array.isArray(product.originalAssets) ? product.originalAssets as Array<{ assetId?: string }> : [];
    return {
      productId: String(product.productId ?? projectId),
      projectId: String(product.projectId ?? projectId),
      identity: {
        name: String(identity.name ?? ""),
        brand: String(identity.brand ?? ""),
        category: String(identity.category ?? ""),
        productType: String(identity.productType ?? ""),
      },
      assetMap: (product.assetMap ?? {}) as Record<string, string[]>,
      originalAssetIds: originals.map((item) => String(item.assetId ?? "")).filter(Boolean),
      visualFeatures: Array.isArray((product.visualAnalysis as { features?: string[] } | undefined)?.features)
        ? (product.visualAnalysis as { features: string[] }).features
        : [],
      sellingPoints: Array.isArray((product.marketingData as { sellingPoints?: string[] } | undefined)?.sellingPoints)
        ? (product.marketingData as { sellingPoints: string[] }).sellingPoints
        : [],
      readiness: String((product.productionData as { readiness?: string } | undefined)?.readiness ?? ""),
    };
  } catch {
    return null;
  }
}

export async function fetchMarketingBrief(projectId: string): Promise<AuthoritativeBriefView | null> {
  try {
    const response = await fetch(`/api/marketing-brief/projects/${encodeURIComponent(projectId)}`);
    if (!response.ok) return null;
    const body = await response.json() as { brief?: AuthoritativeBriefView };
    return body.brief ?? null;
  } catch {
    return null;
  }
}

export async function analyzeMarketingBrief(projectId: string): Promise<AuthoritativeBriefView | null> {
  try {
    const response = await fetch(`/api/marketing-brief/projects/${encodeURIComponent(projectId)}/analyze`, { method: "POST" });
    if (!response.ok) return null;
    const body = await response.json() as { brief?: AuthoritativeBriefView };
    return body.brief ?? null;
  } catch {
    return null;
  }
}

export async function persistMarketingBrief(
  projectId: string,
  patch: Record<string, unknown>,
): Promise<AuthoritativeBriefView | null> {
  try {
    const response = await fetch(`/api/marketing-brief/projects/${encodeURIComponent(projectId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) return null;
    const body = await response.json() as { brief?: AuthoritativeBriefView };
    return body.brief ?? null;
  } catch {
    return null;
  }
}

export async function mutateBriefRecommendation(
  projectId: string,
  recId: string,
  action: "accept" | "reject" | "edit",
  value?: string | string[],
): Promise<AuthoritativeBriefView | null> {
  try {
    const response = await fetch(
      `/api/marketing-brief/projects/${encodeURIComponent(projectId)}/recommendations/${encodeURIComponent(recId)}/${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "edit" ? JSON.stringify({ value }) : undefined,
      },
    );
    if (!response.ok) return null;
    const body = await response.json() as { brief?: AuthoritativeBriefView };
    return body.brief ?? null;
  } catch {
    return null;
  }
}

export async function finalizeMarketingBrief(projectId: string): Promise<AuthoritativeBriefView | null> {
  const response = await fetch(`/api/marketing-brief/projects/${encodeURIComponent(projectId)}/finalize`, { method: "POST" });
  const body = await response.json().catch(() => ({})) as { brief?: AuthoritativeBriefView; error?: string };
  if (!response.ok) throw new Error(body.error ?? "Unable to finalize marketing brief");
  return body.brief ?? null;
}

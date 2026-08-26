import type { ServerImageProfile, ServerProductIntel } from "./analyze";

export async function fetchImageIntelligence(projectId: string): Promise<ServerImageProfile[]> {
  const response = await fetch(`/api/image-intelligence/projects/${projectId}/analyze`, { method: "POST" });
  const body = await response.json() as { profiles?: ServerImageProfile[]; error?: string };
  if (!response.ok) throw new Error(body.error ?? "Image intelligence unavailable");
  return body.profiles ?? [];
}

export async function fetchProductIntelligence(projectId: string): Promise<ServerProductIntel | null> {
  try {
    const response = await fetch(`/api/product-intelligence/projects/${projectId}/analyze`, { method: "POST" });
    if (!response.ok) return null;
    const body = await response.json() as { profile?: ServerProductIntel };
    return body.profile ?? null;
  } catch {
    return null;
  }
}

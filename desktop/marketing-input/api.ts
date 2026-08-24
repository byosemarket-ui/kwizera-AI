import { openProjectApi, getProjectApi, updateProjectApi, type CreativeProjectDto } from "../product-intake/api";

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

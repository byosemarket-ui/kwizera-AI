/** Re-exports workspace API helpers used by the Product Profile engine. */
export { updateProjectApi as updateProjectChanges, openProjectApi, getProjectApi as fetchProject } from "../product-intake/api";
export type { CreativeProjectDto } from "../product-intake/api";

import { openProjectApi, getProjectApi } from "../product-intake/api";
import type { CreativeProjectDto } from "../product-intake/api";

export async function ensureProjectOpen(projectId: string): Promise<CreativeProjectDto> {
  try {
    return await openProjectApi(projectId);
  } catch {
    return getProjectApi(projectId);
  }
}

export async function fetchProductIntelligence(projectId: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`/api/product-intelligence/projects/${projectId}/analyze`, { method: "POST" });
    if (!response.ok) return null;
    const body = await response.json() as { profile?: Record<string, unknown> };
    return body.profile ?? null;
  } catch {
    return null;
  }
}

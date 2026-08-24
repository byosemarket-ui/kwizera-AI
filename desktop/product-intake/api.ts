import type { IntakeHandoffPayload, IntakeAssetMeta } from "./types";
import { INTAKE_HANDOFF_KEY, INTAKE_META_KEY } from "./types";

export interface CreativeProjectDto {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  productImages: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    url: string;
    width?: number;
    height?: number;
    checksumSha256?: string;
    sourceFileName?: string;
  }>;
  productInformation: Record<string, unknown> & {
    name: string;
    category: string;
    description: string;
    brand?: string;
    price?: number;
    currency?: string;
  };
  brandInformation?: {
    name: string;
    website?: string;
    voice?: string;
    guidelines?: string;
    style?: string;
    colors?: string;
    logoAssetId?: string;
  };
  campaignInformation?: {
    name: string;
    objective: string;
    callToAction?: string;
    notes?: string;
    contentFormat?: string;
    duration?: string;
    customDurationSeconds?: number;
    platforms?: string[];
    promotionType?: string;
    promotionDetails?: string;
    tone?: string;
    style?: string;
    mood?: string;
    energy?: string;
  };
  targetAudience?: string;
  language?: string;
  platform?: string;
  workspaceSettings?: Record<string, unknown>;
}

export interface WorkspaceApiPayload {
  activeProject: CreativeProjectDto | null;
  projects: CreativeProjectDto[];
}

export async function fetchWorkspaceApi(): Promise<WorkspaceApiPayload | null> {
  try {
    const response = await fetch("/api/workspace");
    if (!response.ok) return null;
    return await response.json() as WorkspaceApiPayload;
  } catch {
    return null;
  }
}

export async function createProjectApi(name: string): Promise<CreativeProjectDto> {
  const response = await fetch("/api/workspace/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = await response.json() as { project?: CreativeProjectDto; error?: string };
  if (!response.ok || !body.project) throw new Error(body.error ?? "Unable to create project");
  return body.project;
}

export async function openProjectApi(projectId: string): Promise<CreativeProjectDto> {
  const response = await fetch(`/api/workspace/projects/${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "open" }),
  });
  const body = await response.json() as { project?: CreativeProjectDto; error?: string };
  if (!response.ok || !body.project) throw new Error(body.error ?? "Unable to open project");
  return body.project;
}

export async function updateProjectProductName(projectId: string, productName: string): Promise<CreativeProjectDto> {
  return updateProjectApi(projectId, {
    productInformation: { name: productName, category: "Product", description: productName },
  });
}

export async function updateProjectApi(
  projectId: string,
  changes: Record<string, unknown>,
): Promise<CreativeProjectDto> {
  const response = await fetch(`/api/workspace/projects/${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changes }),
  });
  const body = await response.json() as { project?: CreativeProjectDto; error?: string };
  if (!response.ok || !body.project) throw new Error(body.error ?? "Unable to update project");
  return body.project;
}

export async function getProjectApi(projectId: string): Promise<CreativeProjectDto> {
  const response = await fetch(`/api/workspace/projects/${projectId}`);
  const body = await response.json() as { project?: CreativeProjectDto; error?: string };
  if (!response.ok || !body.project) throw new Error(body.error ?? "Unable to load project");
  return body.project;
}

export async function uploadImageApi(projectId: string, input: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  width?: number;
  height?: number;
  checksumSha256?: string;
}): Promise<{ image: CreativeProjectDto["productImages"][number]; project: CreativeProjectDto }> {
  const response = await fetch(`/api/workspace/projects/${projectId}/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json() as {
    image?: CreativeProjectDto["productImages"][number];
    project?: CreativeProjectDto;
    error?: string;
  };
  if (!response.ok || !body.image || !body.project) throw new Error(body.error ?? "Upload failed");
  return { image: body.image, project: body.project };
}

export async function removeImageApi(projectId: string, imageId: string): Promise<CreativeProjectDto> {
  const response = await fetch(`/api/workspace/projects/${projectId}/images/${imageId}`, { method: "DELETE" });
  const body = await response.json() as { project?: CreativeProjectDto; error?: string };
  if (!response.ok || !body.project) throw new Error(body.error ?? "Remove failed");
  return body.project;
}

export function loadMetaMap(): Record<string, IntakeAssetMeta[]> {
  try {
    return JSON.parse(localStorage.getItem(INTAKE_META_KEY) ?? "{}") as Record<string, IntakeAssetMeta[]>;
  } catch {
    return {};
  }
}

export function saveProjectMeta(projectId: string, assets: IntakeAssetMeta[]): void {
  const map = loadMetaMap();
  map[projectId] = assets.map((asset) => {
    const { localPreviewUrl: _drop, ...rest } = asset;
    return rest;
  });
  localStorage.setItem(INTAKE_META_KEY, JSON.stringify(map));
}

export function loadProjectMeta(projectId: string): IntakeAssetMeta[] {
  return loadMetaMap()[projectId] ?? [];
}

export function saveHandoff(payload: IntakeHandoffPayload): void {
  localStorage.setItem(INTAKE_HANDOFF_KEY, JSON.stringify(payload));
}

export function loadHandoff(): IntakeHandoffPayload | null {
  try {
    const raw = JSON.parse(localStorage.getItem(INTAKE_HANDOFF_KEY) ?? "null") as IntakeHandoffPayload | null;
    return raw?.version === 1 ? raw : null;
  } catch {
    return null;
  }
}

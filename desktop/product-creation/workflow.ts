/**
 * Product Creation workflow binding — shared project identity + scoped handoffs.
 * Reuses CreativeWorkspace via /api/workspace. Does not create a second project system.
 */

import {
  fetchWorkspaceApi,
  openProjectApi,
  updateProjectApi,
  type CreativeProjectDto,
} from "../product-intake/api";

export type ProductCreationStep = 1 | 2 | 3 | 4 | 5;

export interface ProductCreationWorkflowState {
  currentStep: ProductCreationStep;
  completedSteps: ProductCreationStep[];
  updatedAt: string;
}

const WORKFLOW_KEY = "productCreation";
const IMAGE_SET_KEY = "productImageSet";

export async function fetchActiveProject(): Promise<CreativeProjectDto | null> {
  const payload = await fetchWorkspaceApi();
  return payload?.activeProject ?? null;
}

/** Resolve which project this step should bind to — never invent a random first store entry. */
export async function resolveBoundProject(opts?: {
  handoffProjectId?: string | null;
}): Promise<{ projectId: string; projectName: string; project: CreativeProjectDto } | null> {
  const active = await fetchActiveProject();
  const preferredId = opts?.handoffProjectId?.trim() || active?.id || null;
  if (!preferredId) return null;

  try {
    const project = await openProjectApi(preferredId);
    return { projectId: project.id, projectName: project.name, project };
  } catch {
    if (active?.id && active.id !== preferredId) {
      try {
        const project = await openProjectApi(active.id);
        return { projectId: project.id, projectName: project.name, project };
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Read handoff: prefer scoped map[projectId], then legacy single blob if project matches. */
export function readScopedHandoff<T extends { version?: number; projectId?: string }>(
  key: string,
  projectId?: string | null,
): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T | { byProject?: Record<string, T>; last?: T };
    if (parsed && typeof parsed === "object" && "byProject" in parsed && parsed.byProject) {
      if (projectId && parsed.byProject[projectId]) return parsed.byProject[projectId] ?? null;
      if (parsed.last?.projectId && (!projectId || parsed.last.projectId === projectId)) {
        return parsed.last;
      }
      return null;
    }
    const legacy = parsed as T;
    if (legacy?.version !== 1) return null;
    if (projectId && legacy.projectId && legacy.projectId !== projectId) return null;
    return legacy;
  } catch {
    return null;
  }
}

/** Write handoff scoped by projectId while keeping a `last` pointer for navigation. */
export function writeScopedHandoff<T extends { version: number; projectId: string }>(
  key: string,
  payload: T,
): void {
  let byProject: Record<string, T> = {};
  try {
    const existing = JSON.parse(localStorage.getItem(key) ?? "null") as
      | { byProject?: Record<string, T> }
      | T
      | null;
    if (existing && typeof existing === "object" && "byProject" in existing && existing.byProject) {
      byProject = { ...existing.byProject };
    } else if (existing && typeof existing === "object" && "projectId" in existing && (existing as T).projectId) {
      const leg = existing as T;
      byProject[leg.projectId] = leg;
    }
  } catch {
    byProject = {};
  }
  byProject[payload.projectId] = payload;
  localStorage.setItem(key, JSON.stringify({ byProject, last: payload }));
}

export function getWorkflowState(project: CreativeProjectDto | null | undefined): ProductCreationWorkflowState | null {
  const raw = project?.workspaceSettings?.[WORKFLOW_KEY];
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Partial<ProductCreationWorkflowState>;
  if (!w.currentStep) return null;
  return {
    currentStep: w.currentStep as ProductCreationStep,
    completedSteps: Array.isArray(w.completedSteps) ? (w.completedSteps as ProductCreationStep[]) : [],
    updatedAt: typeof w.updatedAt === "string" ? w.updatedAt : new Date().toISOString(),
  };
}

export async function persistWorkflowStep(
  projectId: string,
  currentStep: ProductCreationStep,
  completedStep?: ProductCreationStep,
): Promise<void> {
  const project = await openProjectApi(projectId);
  const prev = getWorkflowState(project);
  const completed = new Set(prev?.completedSteps ?? []);
  if (completedStep) completed.add(completedStep);
  const next: ProductCreationWorkflowState = {
    currentStep,
    completedSteps: [...completed].sort((a, b) => a - b) as ProductCreationStep[],
    updatedAt: new Date().toISOString(),
  };
  await updateProjectApi(projectId, {
    workspaceSettings: {
      ...(project.workspaceSettings ?? {}),
      [WORKFLOW_KEY]: next,
    },
  });
  console.info("[PRODUCT_CREATION_STEP]", { projectId, ...next });
}

export async function persistProductImageSet(projectId: string, productImageSet: unknown): Promise<void> {
  const project = await openProjectApi(projectId);
  await updateProjectApi(projectId, {
    workspaceSettings: {
      ...(project.workspaceSettings ?? {}),
      [IMAGE_SET_KEY]: productImageSet,
    },
  });
}

export function readProductImageSetFromProject(project: CreativeProjectDto): unknown | null {
  return project.workspaceSettings?.[IMAGE_SET_KEY] ?? null;
}

/**
 * Prerequisite gate for opening a step. Returns null if OK, else user-facing reason.
 * Soft checks based on durable project data (not mock).
 */
export function prerequisiteBlockReason(
  step: ProductCreationStep,
  project: CreativeProjectDto | null,
): string | null {
  if (!project) return "Create or open a product project first (Step 1).";
  if (step <= 1) return null;
  if (!project.productImages?.length) {
    return "Import at least one product image in Step 1 before continuing.";
  }
  if (step <= 2) return null;
  const workflow = getWorkflowState(project);
  const hasImageSet = Boolean(project.workspaceSettings?.[IMAGE_SET_KEY]);
  const step2Done = workflow?.completedSteps?.includes(2) || hasImageSet;
  if (step >= 3 && !step2Done) {
    return "Complete Image Organization (Step 2) before Product Information.";
  }
  if (step <= 3) return null;
  const name = project.productInformation?.name?.trim();
  const step3Done = workflow?.completedSteps?.includes(3) || Boolean(name);
  if (step >= 4 && !step3Done) {
    return "Complete Product Information (Step 3) before Marketing.";
  }
  if (step <= 4) return null;
  const campaign = project.campaignInformation?.name?.trim() || project.campaignInformation?.objective?.trim();
  const brief = project.workspaceSettings?.marketingInputBrief;
  const step4Done = workflow?.completedSteps?.includes(4) || Boolean(campaign) || Boolean(brief);
  if (step >= 5 && !step4Done) {
    return "Complete Marketing Input (Step 4) before Validation.";
  }
  return null;
}

/** Pick store entry only for the bound projectId — never Object.values()[0]. */
export function pickStoreForProject<T>(
  map: Record<string, T>,
  projectId: string | null | undefined,
): T | null {
  if (!projectId) return null;
  return map[projectId] ?? null;
}

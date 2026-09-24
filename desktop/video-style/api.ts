export {
  fetchCanonicalProduct,
  fetchMarketingBrief,
  fetchWorkspaceApi,
  openProjectApi,
} from "../video-requirements/api.js";

export {
  finalizeCreativePlan,
  generateCreativePlan,
  getCreativePlan,
  getProductionManifest,
  updateCreativePlan,
} from "../deep-intelligence/live-api.js";

export async function fetchProductionCapabilities(uniqueViewCount: number) {
  const response = await fetch(`/api/video-production/capabilities?views=${uniqueViewCount}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Capabilities request failed (${response.status})`);
  }
  return response.json() as Promise<{
    capabilities: Array<{
      mode: import("../../ai/video-production/production-mode-types.js").ProductionModeId;
      label: string;
      description: string;
      available: boolean;
      provider: string;
      reason: string;
      limitations: string[];
      recommended?: boolean;
    }>;
    qa?: { visionQaAvailable?: boolean };
  }>;
}

export async function fetchVisionIdentityQa(projectId: string): Promise<{
  visionQaAvailable: boolean;
  visionIdentity: {
    status: "PASS" | "FAIL" | "UNCERTAIN" | "UNAVAILABLE" | "SKIPPED";
    onlineExecuted: boolean;
    failures: string[];
    warnings: string[];
    evidence: string[];
    confidence: number;
  } | null;
}> {
  const response = await fetch(`/api/video-production/projects/${projectId}/qa/vision-identity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await response.json() as {
    visionQaAvailable?: boolean;
    visionIdentity?: {
      status: "PASS" | "FAIL" | "UNCERTAIN" | "UNAVAILABLE" | "SKIPPED";
      onlineExecuted: boolean;
      failures: string[];
      warnings: string[];
      evidence: string[];
      confidence: number;
    } | null;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error ?? `Vision identity QA failed (${response.status})`);
  }
  return {
    visionQaAvailable: Boolean(body.visionQaAvailable),
    visionIdentity: body.visionIdentity ?? null,
  };
}

export async function generatePlanWithMode(
  projectId: string,
  productionMode: import("../../ai/video-production/production-mode-types.js").ProductionModeId,
  creativeTone: import("../../ai/video-production/production-mode-types.js").CreativeToneId | null,
  regenerate = false,
  durationSeconds?: number,
) {
  const response = await fetch(`/api/workspace/projects/${projectId}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "generate", productionMode, creativeTone, regenerate, durationSeconds }),
  });
  const body = await response.json() as { plan?: import("../deep-intelligence/live-api.js").CreativePlanDto; error?: string };
  if (!response.ok) throw new Error(body.error ?? `Plan generation failed (${response.status})`);
  if (!body.plan) throw new Error("Plan generation returned no plan");
  return body.plan;
}

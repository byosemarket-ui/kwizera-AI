import type { AdminControlPlaneManager } from "../admin-control-plane/admin-control-plane-manager.js";
import type { CanonicalProductManager } from "../product-record/canonical-product-manager.js";
import type { CreativePlanningManager } from "../creative-planning/creative-planning-manager.js";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import { ffmpegAvailable } from "../video-production/ffmpeg-renderer.js";
import { setAdminOnlineImageToVideoAvailable } from "../video-production/production-mode-types.js";
import { getVideoGenerationProvider } from "../video-production/video-generation-provider.js";
import type { VideoProductionManager } from "../video-production/video-production-manager.js";
import { PmvWorkflowOrchestrator } from "./engine.js";
import { createStepExecutors, loadWorkflowSnapshot, type ExecutorManagers } from "./executors.js";
import { createModeReadinessProbe } from "./mode-readiness.js";
import { setPmvModeReadiness, setPmvOrchestrator } from "./registry.js";
import { PMV_WORKFLOW_SETTINGS_KEY } from "./types.js";

export interface PmvOrchestratorBootstrap {
  storageRoot: string;
  workspace: CreativeWorkspaceManager;
  planning: CreativePlanningManager;
  production: VideoProductionManager;
  intelligence: ProductIntelligenceManager | null;
  canonical: CanonicalProductManager | null;
  admin: () => AdminControlPlaneManager | null;
}

const SAFE_LOG_KEYS = new Set(["workflowId", "projectId", "step", "attempt", "failureClass", "code"]);

/** Creates, initializes, and registers the orchestrator. Recovery of interrupted workflows happens here. */
export async function bootstrapPmvOrchestrator(input: PmvOrchestratorBootstrap): Promise<PmvWorkflowOrchestrator> {
  const runtime = () => input.admin()?.getCapabilityRuntime() ?? null;
  const i2vPipelineReady = async () => {
    try {
      const provider = getVideoGenerationProvider();
      return (await provider.isAvailable()) && typeof provider.generateVideoClip === "function";
    } catch {
      return false;
    }
  };
  const probe = createModeReadinessProbe({
    runtime,
    rendererAvailable: () => ffmpegAvailable(),
    productIntelligenceAvailable: () => Boolean(input.intelligence),
    imageToVideoPipelineReady: i2vPipelineReady,
  });
  const modeReadiness = async () => {
    const map = await probe();
    // The render layer decides generative vs still rendering from this flag; keep it equal to executable truth.
    setAdminOnlineImageToVideoAvailable(Boolean(map.VIDEO_IMAGE_TO_VIDEO?.executable));
    return map;
  };
  const managers: ExecutorManagers = {
    workspace: input.workspace,
    planning: input.planning,
    production: input.production,
    intelligence: input.intelligence,
    canonical: input.canonical,
    runtime,
    i2vAvailable: async () => Boolean((await modeReadiness()).VIDEO_IMAGE_TO_VIDEO?.executable),
    modeReadiness,
  };
  const orchestrator = new PmvWorkflowOrchestrator();
  setPmvOrchestrator(orchestrator);
  setPmvModeReadiness(modeReadiness);
  await orchestrator.initialize(input.storageRoot, {
    loadSnapshot: (projectId) => loadWorkflowSnapshot(managers, projectId),
    executors: createStepExecutors(managers),
    writeProjectSummary: async (projectId, summary) => {
      await input.workspace.updateProject(projectId, { workspaceSettings: { [PMV_WORKFLOW_SETTINGS_KEY]: summary } });
    },
    log: (event, data) => {
      const safe: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (SAFE_LOG_KEYS.has(key)) safe[key] = value;
      }
      console.log(`[KWIZERA] ${event}`, JSON.stringify(safe));
    },
  });
  return orchestrator;
}

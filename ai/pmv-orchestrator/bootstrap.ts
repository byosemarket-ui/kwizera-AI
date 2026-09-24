import type { AdminControlPlaneManager } from "../admin-control-plane/admin-control-plane-manager.js";
import type { CanonicalProductManager } from "../product-record/canonical-product-manager.js";
import type { CreativePlanningManager } from "../creative-planning/creative-planning-manager.js";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import { cinematicProviderConfigured } from "../video-production/production-mode-types.js";
import { getVideoGenerationProvider } from "../video-production/video-generation-provider.js";
import type { VideoProductionManager } from "../video-production/video-production-manager.js";
import { PmvWorkflowOrchestrator } from "./engine.js";
import { createStepExecutors, loadWorkflowSnapshot, type ExecutorManagers } from "./executors.js";
import { setPmvOrchestrator } from "./registry.js";
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
  const managers: ExecutorManagers = {
    workspace: input.workspace,
    planning: input.planning,
    production: input.production,
    intelligence: input.intelligence,
    canonical: input.canonical,
    runtime: () => input.admin()?.getCapabilityRuntime() ?? null,
    i2vAvailable: async () => {
      if (!cinematicProviderConfigured()) return false;
      try {
        const provider = getVideoGenerationProvider();
        return (await provider.isAvailable()) && typeof provider.generateVideoClip === "function";
      } catch {
        return false;
      }
    },
  };
  const orchestrator = new PmvWorkflowOrchestrator();
  setPmvOrchestrator(orchestrator);
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

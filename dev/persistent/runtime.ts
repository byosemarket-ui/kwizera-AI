import type { AiCore } from "../../ai/core/ai-core.js";
import { CreativePlanningManager } from "../../ai/creative-planning/creative-planning-manager.js";
import { CreativePipelineManager } from "../../ai/creative-pipeline/creative-pipeline-manager.js";
import { CreativeReviewManager } from "../../ai/creative-review/creative-review-manager.js";
import { CreativeWorkspaceManager } from "../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageGenerationManager } from "../../ai/image-generation/image-generation-manager.js";
import { createImageGenerationPlugin } from "../../ai/image-generation/image-generation-plugin.js";
import { AiModelManager } from "../../ai/model-management/ai-model-manager.js";
import { VideoAudioGenerationManager } from "../../ai/video-audio-generation/video-audio-generation-manager.js";
import { createVideoAudioGenerationPlugin } from "../../ai/video-audio-generation/video-audio-generation-plugin.js";
import { GenerationOptimizationManager } from "../../ai/generation-optimization/generation-optimization-manager.js";
import { createGenerationOptimizationPlugin } from "../../ai/generation-optimization/generation-optimization-plugin.js";
import { ProductIntelligenceManager } from "../../ai/product-intelligence/product-intelligence-manager.js";
import { createProductIntelligencePlugin } from "../../ai/product-intelligence/product-intelligence-plugin.js";
import { ImageIntelligenceManager } from "../../ai/image-intelligence/image-intelligence-manager.js";
import { createImageIntelligencePlugin } from "../../ai/image-intelligence/image-intelligence-plugin.js";
import { MarketingIntelligenceManager } from "../../ai/marketing-intelligence/marketing-intelligence-manager.js";
import { createMarketingIntelligencePlugin } from "../../ai/marketing-intelligence/marketing-intelligence-plugin.js";
import { DecisionIntelligenceManager } from "../../ai/decision-intelligence/decision-intelligence-manager.js";
import { createDecisionIntelligencePlugin } from "../../ai/decision-intelligence/decision-intelligence-plugin.js";
import { AiLearningManager } from "../../ai/learning-intelligence/learning-intelligence-manager.js";
import { createLearningIntelligencePlugin } from "../../ai/learning-intelligence/learning-intelligence-plugin.js";
import { resolveStorageRoot } from "../../storage/paths/storage-paths.js";
import { buildRegistry } from "../server/module-registry.js";
import { DevSessionStore, type DevRuntimeSnapshot } from "./session-store.js";
import { bootstrapPersistentStorage } from "./storage-bootstrap.js";

export interface PersistentRuntimeStatus {
  ready: boolean;
  booting: boolean;
  storageRoot: string;
  sessionId: string;
  restored: boolean;
  message: string;
  runtime: DevRuntimeSnapshot;
  modules: {
    total: number;
    connected: number;
    phases: number;
  };
  bootstrap: {
    created: number;
    existing: number;
  };
}

let core: AiCore | null = null;
let workspaceManager: CreativeWorkspaceManager | null = null;
let planningManager: CreativePlanningManager | null = null;
let reviewManager: CreativeReviewManager | null = null;
let pipelineManager: CreativePipelineManager | null = null;
let modelManager: AiModelManager | null = null;
let imageGenerationManager: ImageGenerationManager | null = null;
let videoAudioGenerationManager: VideoAudioGenerationManager | null = null;
let generationOptimizationManager: GenerationOptimizationManager | null = null;
let productIntelligenceManager: ProductIntelligenceManager | null = null;
let imageIntelligenceManager: ImageIntelligenceManager | null = null;
let marketingIntelligenceManager: MarketingIntelligenceManager | null = null;
let decisionIntelligenceManager: DecisionIntelligenceManager | null = null;
let learningIntelligenceManager: AiLearningManager | null = null;
let sessionStore: DevSessionStore | null = null;
let status: PersistentRuntimeStatus | null = null;
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
let bootPromise: Promise<PersistentRuntimeStatus> | null = null;

function buildDashboardUrl(host: string, port: number): string {
  return `http://${host}:${port}`;
}

function countConnectedModules(): { total: number; connected: number; phases: number } {
  const phases = buildRegistry();
  const modules = phases.flatMap((p) => p.modules).filter((m) => m.kind !== "blueprint");
  const connected = modules.filter((m) => m.status === "pass" && m.aiPath).length;
  return { total: modules.length, connected, phases: phases.length };
}

async function collectRuntimeSnapshot(manager: ReturnType<AiCore["getManager"]>): Promise<DevRuntimeSnapshot> {
  const report = manager.getStatusReport();
  const memory = manager.memoryFoundation;
  const knowledge = manager.knowledgeFoundation;
  const stateManager = manager.stateManager;

  const memoryReport = memory?.buildStatusReport();
  const knowledgeReport = knowledge?.buildStatusReport();
  const restoration = stateManager?.getLastRestoration();
  const projectCount = Object.keys(stateManager?.getCurrentSnapshot().projects ?? {}).length;
  const moduleCounts = countConnectedModules();

  return {
    readinessScore: report.readinessScore,
    memoryLoaded: memoryReport?.persistenceStatus === "survives restart" || memoryReport?.foundationStatus === "operational",
    knowledgeLoaded: knowledgeReport?.persistenceStatus === "survives restart" || knowledgeReport?.foundationStatus === "operational",
    projectStateRestored: restoration?.restored === true || projectCount > 0,
    modulesConnected: moduleCounts.connected,
    lifecycleState: String(manager.getLifecycleState()),
    memoryReadiness: memoryReport?.readinessScore ?? null,
    knowledgeReadiness: knowledgeReport?.readinessScore ?? null,
    projectCount,
  };
}

export function getPersistentRuntime(): AiCore | null {
  return core;
}

export function getWorkspaceManager(): CreativeWorkspaceManager | null {
  return workspaceManager;
}

export function getPlanningManager(): CreativePlanningManager | null {
  return planningManager;
}

export function getReviewManager(): CreativeReviewManager | null {
  return reviewManager;
}

export function getPipelineManager(): CreativePipelineManager | null {
  return pipelineManager;
}

export function getModelManager(): AiModelManager | null {
  return modelManager;
}

export function getImageGenerationManager(): ImageGenerationManager | null {
  return imageGenerationManager;
}

export function getVideoAudioGenerationManager(): VideoAudioGenerationManager | null {
  return videoAudioGenerationManager;
}

export function getGenerationOptimizationManager(): GenerationOptimizationManager | null {
  return generationOptimizationManager;
}

export function getProductIntelligenceManager(): ProductIntelligenceManager | null {
  return productIntelligenceManager;
}

export function getImageIntelligenceManager(): ImageIntelligenceManager | null {
  return imageIntelligenceManager;
}

export function getMarketingIntelligenceManager(): MarketingIntelligenceManager | null {
  return marketingIntelligenceManager;
}

export function getDecisionIntelligenceManager(): DecisionIntelligenceManager | null {
  return decisionIntelligenceManager;
}

export function getLearningIntelligenceManager(): AiLearningManager | null {
  return learningIntelligenceManager;
}

export function getSessionStore(): DevSessionStore | null {
  return sessionStore;
}

export function getRuntimeStatus(): PersistentRuntimeStatus | null {
  return status;
}

export function isPersistentMode(): boolean {
  return process.env.KWIZERA_PERSISTENT_MODE !== "0";
}

export async function bootPersistentRuntime(host: string, port: number): Promise<PersistentRuntimeStatus> {
  if (bootPromise) return bootPromise;
  if (status?.ready) return status;

  bootPromise = (async () => {
    const storageRoot = resolveStorageRoot();
    const dashboardUrl = buildDashboardUrl(host, port);
    const bootstrap = bootstrapPersistentStorage(storageRoot);
    sessionStore = new DevSessionStore(storageRoot, dashboardUrl);

    status = {
      ready: false,
      booting: true,
      storageRoot,
      sessionId: sessionStore.get().sessionId,
      restored: false,
      message: "Booting persistent AI runtime…",
      runtime: sessionStore.get().lastRuntime,
      modules: countConnectedModules(),
      bootstrap: { created: bootstrap.created.length, existing: bootstrap.existing.length },
    };

    if (!isPersistentMode()) {
      status.message = "Persistent mode disabled — dashboard only";
      status.booting = false;
      status.ready = true;
      return status;
    }

    try {
      console.log("[KWIZERA] Restoring persistent session from", storageRoot);
      const { createAiCore } = await import("../../ai/core/index.js");
      core = createAiCore({ storageRootOverride: storageRoot });
      const manager = core.getManager();

      await core.start("persistent-dev-restore");
      workspaceManager = new CreativeWorkspaceManager();
      await workspaceManager.initialize(storageRoot, manager);
      planningManager = new CreativePlanningManager();
      await planningManager.initialize(storageRoot, manager);
      reviewManager = new CreativeReviewManager();
      await reviewManager.initialize(storageRoot, manager);
      pipelineManager = new CreativePipelineManager();
      await pipelineManager.initialize(storageRoot, { core: manager, workspace: workspaceManager, planning: planningManager, review: reviewManager });
      modelManager = manager.modelManager;
      if (!modelManager) throw new Error("AI Model Management is not available");
      imageGenerationManager = new ImageGenerationManager();
      await imageGenerationManager.initialize(storageRoot, { core: manager, models: modelManager, workspace: workspaceManager, planning: planningManager });
      if (manager.moduleManager) await manager.moduleManager.registerAndInitialize(createImageGenerationPlugin(imageGenerationManager, manager));
      videoAudioGenerationManager = new VideoAudioGenerationManager();
      await videoAudioGenerationManager.initialize(storageRoot, { core: manager, models: modelManager, workspace: workspaceManager, planning: planningManager, images: imageGenerationManager });
      if (manager.moduleManager) await manager.moduleManager.registerAndInitialize(createVideoAudioGenerationPlugin(videoAudioGenerationManager, manager));
      generationOptimizationManager = new GenerationOptimizationManager();
      await generationOptimizationManager.initialize(storageRoot, { core: manager, models: modelManager, images: imageGenerationManager, videoAudio: videoAudioGenerationManager });
      if (manager.moduleManager) await manager.moduleManager.registerAndInitialize(createGenerationOptimizationPlugin(generationOptimizationManager, manager));
      pipelineManager.attachGenerationOptimization(generationOptimizationManager);
      imageIntelligenceManager = new ImageIntelligenceManager();
      await imageIntelligenceManager.initialize(storageRoot, { core: manager, workspace: workspaceManager });
      if (manager.moduleManager) await manager.moduleManager.registerAndInitialize(createImageIntelligencePlugin(imageIntelligenceManager, manager));
      productIntelligenceManager = new ProductIntelligenceManager();
      await productIntelligenceManager.initialize(storageRoot, { core: manager, workspace: workspaceManager });
      if (manager.moduleManager) await manager.moduleManager.registerAndInitialize(createProductIntelligencePlugin(productIntelligenceManager, manager));
      productIntelligenceManager.attachImageIntelligence(imageIntelligenceManager);
        marketingIntelligenceManager = new MarketingIntelligenceManager();
        await marketingIntelligenceManager.initialize(storageRoot, { core: manager, workspace: workspaceManager, products: productIntelligenceManager, images: imageIntelligenceManager });
        if (manager.moduleManager) await manager.moduleManager.registerAndInitialize(createMarketingIntelligencePlugin(marketingIntelligenceManager, manager));
        planningManager.attachMarketingIntelligence(marketingIntelligenceManager);
        decisionIntelligenceManager = new DecisionIntelligenceManager();
        await decisionIntelligenceManager.initialize(storageRoot, { core: manager, workspace: workspaceManager, models: modelManager, products: productIntelligenceManager, images: imageIntelligenceManager, marketing: marketingIntelligenceManager });
        if (manager.moduleManager) await manager.moduleManager.registerAndInitialize(createDecisionIntelligencePlugin(decisionIntelligenceManager, manager));
        planningManager.attachDecisionIntelligence(decisionIntelligenceManager);
        learningIntelligenceManager = new AiLearningManager();
        await learningIntelligenceManager.initialize(storageRoot, { core: manager, workspace: workspaceManager, products: productIntelligenceManager, images: imageIntelligenceManager, marketing: marketingIntelligenceManager, decisions: decisionIntelligenceManager });
        if (manager.moduleManager) await manager.moduleManager.registerAndInitialize(createLearningIntelligencePlugin(learningIntelligenceManager, manager));
      imageGenerationManager.attachProductIntelligence(productIntelligenceManager);
      videoAudioGenerationManager.attachProductIntelligence(productIntelligenceManager);
      imageGenerationManager.attachImageIntelligence(imageIntelligenceManager);
      videoAudioGenerationManager.attachImageIntelligence(imageIntelligenceManager);
        imageGenerationManager.attachMarketingIntelligence(marketingIntelligenceManager);
        videoAudioGenerationManager.attachMarketingIntelligence(marketingIntelligenceManager);
        imageGenerationManager.attachDecisionIntelligence(decisionIntelligenceManager);
        videoAudioGenerationManager.attachDecisionIntelligence(decisionIntelligenceManager);
      pipelineManager.attachProductIntelligence(productIntelligenceManager);
      pipelineManager.attachImageIntelligence(imageIntelligenceManager);
        pipelineManager.attachMarketingIntelligence(marketingIntelligenceManager);
        pipelineManager.attachDecisionIntelligence(decisionIntelligenceManager);
        pipelineManager.attachLearningIntelligence(learningIntelligenceManager);
        imageGenerationManager.attachLearningIntelligence(learningIntelligenceManager);
        videoAudioGenerationManager.attachLearningIntelligence(learningIntelligenceManager);
      const snapshot = await collectRuntimeSnapshot(manager);
      sessionStore.updateRuntime(snapshot);

      const previousSession = sessionStore.get();
      const restored = previousSession.startCount > 1 || snapshot.projectStateRestored ||
        snapshot.memoryLoaded || snapshot.knowledgeLoaded;

      status = {
        ready: true,
        booting: false,
        storageRoot,
        sessionId: sessionStore.get().sessionId,
        restored,
        message: restored
          ? "Previous session restored — all engines reconnected"
          : "Fresh persistent session initialized",
        runtime: snapshot,
        modules: countConnectedModules(),
        bootstrap: { created: bootstrap.created.length, existing: bootstrap.existing.length },
      };

      console.log(`[KWIZERA] ${status.message}`);
      console.log(`[KWIZERA] Memory: ${snapshot.memoryLoaded ? "loaded" : "pending"}, Knowledge: ${snapshot.knowledgeLoaded ? "loaded" : "pending"}, Projects: ${snapshot.projectCount}`);

      autoSaveTimer = setInterval(() => {
        void saveRuntimeSnapshot();
      }, 60_000);

      return status;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      status = {
        ready: false,
        booting: false,
        storageRoot,
        sessionId: sessionStore.get().sessionId,
        restored: false,
        message: `Runtime boot failed: ${message}`,
        runtime: sessionStore.get().lastRuntime,
        modules: countConnectedModules(),
        bootstrap: { created: bootstrap.created.length, existing: bootstrap.existing.length },
      };
      console.error("[KWIZERA] Persistent runtime boot failed:", message);
      return status;
    } finally {
      bootPromise = null;
    }
  })();

  return bootPromise;
}

export async function saveRuntimeSnapshot(): Promise<void> {
  if (!core || !sessionStore) return;
  try {
    const snapshot = await collectRuntimeSnapshot(core.getManager());
    sessionStore.updateRuntime(snapshot);
    if (status) {
      status.runtime = snapshot;
      status.modules = countConnectedModules();
    }
  } catch {
    /* ignore autosave errors */
  }
}

export async function shutdownPersistentRuntime(): Promise<void> {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }

  await saveRuntimeSnapshot();
  sessionStore?.markShutdown();

  if (core) {
    try {
      await core.stop("persistent-dev-shutdown");
    } catch {
      /* ignore */
    }
    core = null;
    workspaceManager = null;
    planningManager = null;
    reviewManager = null;
    pipelineManager = null;
    modelManager = null;
    imageGenerationManager = null;
    videoAudioGenerationManager = null;
    generationOptimizationManager = null;
    productIntelligenceManager = null;
    imageIntelligenceManager = null;
    marketingIntelligenceManager = null;
    decisionIntelligenceManager = null;
    learningIntelligenceManager = null;
  }

  if (status) {
    status.ready = false;
    status.message = "Shutdown complete — session saved";
  }
}

export function registerShutdownHandlers(): void {
  const handler = () => {
    void shutdownPersistentRuntime().finally(() => process.exit(0));
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
  process.on("beforeExit", () => {
    void saveRuntimeSnapshot();
  });
}

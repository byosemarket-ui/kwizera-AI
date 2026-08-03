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
import { CommercialVideoManager } from "../../ai/commercial-video/commercial-video-manager.js";
import { BusinessIntelligenceManager } from "../../ai/business-intelligence/business-intelligence-manager.js";
import { GenerationOptimizationManager } from "../../ai/generation-optimization/generation-optimization-manager.js";
import { createGenerationOptimizationPlugin } from "../../ai/generation-optimization/generation-optimization-plugin.js";
import { ProductIntelligenceManager } from "../../ai/product-intelligence/product-intelligence-manager.js";
import { createProductIntelligencePlugin } from "../../ai/product-intelligence/product-intelligence-plugin.js";
import { ImageIntelligenceManager } from "../../ai/image-intelligence/image-intelligence-manager.js";
import { createImageIntelligencePlugin } from "../../ai/image-intelligence/image-intelligence-plugin.js";
import { ProductPhotographyManager } from "../../ai/product-photography/product-photography-manager.js";
import { MarketingIntelligenceManager } from "../../ai/marketing-intelligence/marketing-intelligence-manager.js";
import { createMarketingIntelligencePlugin } from "../../ai/marketing-intelligence/marketing-intelligence-plugin.js";
import { MarketingContentManager } from "../../ai/marketing-content/marketing-content-manager.js";
import { DecisionIntelligenceManager } from "../../ai/decision-intelligence/decision-intelligence-manager.js";
import { createDecisionIntelligencePlugin } from "../../ai/decision-intelligence/decision-intelligence-plugin.js";
import { AiLearningManager } from "../../ai/learning-intelligence/learning-intelligence-manager.js";
import { WorkspaceSynchronizationManager } from "../../ai/workspace-synchronization/workspace-synchronization-manager.js";
import { EnterpriseIntegrationManager } from "../../ai/enterprise-integration/enterprise-integration-manager.js";
import { PublishingDistributionManager } from "../../ai/publishing-distribution/publishing-distribution-manager.js";
import { EnterpriseCollaborationManager } from "../../ai/enterprise-collaboration/enterprise-collaboration-manager.js";
import type { DesktopPermission } from "../../ai/desktop-integration/types.js";
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
let commercialVideoManager: CommercialVideoManager | null = null;
let businessIntelligenceManager: BusinessIntelligenceManager | null = null;
let generationOptimizationManager: GenerationOptimizationManager | null = null;
let productIntelligenceManager: ProductIntelligenceManager | null = null;
let imageIntelligenceManager: ImageIntelligenceManager | null = null;
let productPhotographyManager: ProductPhotographyManager | null = null;
let marketingIntelligenceManager: MarketingIntelligenceManager | null = null;
let marketingContentManager: MarketingContentManager | null = null;
let decisionIntelligenceManager: DecisionIntelligenceManager | null = null;
let learningIntelligenceManager: AiLearningManager | null = null;
let workspaceSynchronizationManager: WorkspaceSynchronizationManager | null = null;
let enterpriseIntegrationManager: EnterpriseIntegrationManager | null = null;
let publishingDistributionManager: PublishingDistributionManager | null = null;
let enterpriseCollaborationManager: EnterpriseCollaborationManager | null = null;
let sessionStore: DevSessionStore | null = null;
let status: PersistentRuntimeStatus | null = null;
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
let publishingScheduleTimer: ReturnType<typeof setInterval> | null = null;
let bootPromise: Promise<PersistentRuntimeStatus> | null = null;

function requireMarketingContentManager(): MarketingContentManager {
  if (!marketingContentManager) throw new Error("Marketing content runtime is not ready");
  return marketingContentManager;
}

function requireCommercialVideoManager(): CommercialVideoManager {
  if (!commercialVideoManager) throw new Error("Commercial video runtime is not ready");
  return commercialVideoManager;
}

function requireBusinessIntelligenceManager(): BusinessIntelligenceManager {
  if (!businessIntelligenceManager) throw new Error("Business intelligence runtime is not ready");
  return businessIntelligenceManager;
}

function requireWorkspaceSynchronizationManager(): WorkspaceSynchronizationManager {
  if (!workspaceSynchronizationManager) throw new Error("Workspace synchronization runtime is not ready");
  return workspaceSynchronizationManager;
}

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

export function getCommercialVideoManager(): CommercialVideoManager | null {
  return commercialVideoManager;
}

export function getBusinessIntelligenceManager(): BusinessIntelligenceManager | null {
  return businessIntelligenceManager;
}

export function getWorkspaceSynchronizationManager(): WorkspaceSynchronizationManager | null {
  return workspaceSynchronizationManager;
}

export function getEnterpriseIntegrationManager(): EnterpriseIntegrationManager | null {
  return enterpriseIntegrationManager;
}

export function getPublishingDistributionManager(): PublishingDistributionManager | null {
  return publishingDistributionManager;
}

export function getEnterpriseCollaborationManager(): EnterpriseCollaborationManager | null {
  return enterpriseCollaborationManager;
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

export function getProductPhotographyManager(): ProductPhotographyManager | null {
  return productPhotographyManager;
}

export function getMarketingIntelligenceManager(): MarketingIntelligenceManager | null {
  return marketingIntelligenceManager;
}

export function getMarketingContentManager(): MarketingContentManager | null {
  return marketingContentManager;
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
      const backup = manager.memoryFoundation?.getMemoryBackupEngine();
      const desktop = manager.desktopIntegrationManager;
      workspaceSynchronizationManager = new WorkspaceSynchronizationManager({
        backup: backup ? {
          createManualBackup: (projectId) => backup.createManualBackup(projectId),
          restore: async (backupId, _mode, pathPrefixes) => backup.restore(backupId, undefined, pathPrefixes),
        } : undefined,
        desktop: desktop ? {
          backup: async (_rootId, relativePath) => desktop.backup("studio", relativePath, "backup", ["filesystem.read", "filesystem.write", "project.access"] as DesktopPermission[]),
          recoverBackup: async (backupId) => desktop.recoverBackup(backupId, ["filesystem.read", "filesystem.write", "project.access"] as DesktopPermission[]),
        } : undefined,
      });
      await workspaceSynchronizationManager.initialize(storageRoot);
      if (!manager.connectorManager) throw new Error("Connector Management is not available");
      enterpriseIntegrationManager = new EnterpriseIntegrationManager(manager.connectorManager);
      await enterpriseIntegrationManager.initialize(storageRoot);
      manager.conversationEngine?.setEnterpriseIntegrationStatusProvider({
        getSummary: () => {
          const integration = enterpriseIntegrationManager?.getStatus();
          return integration ? {
            total: integration.connectors.total,
            enabled: integration.connectors.enabled,
            unhealthy: integration.connectors.unhealthy,
            routes: integration.gateway.routes,
            webhooks: integration.webhooks.registered,
          } : null;
        },
      });
      manager.conversationEngine?.setWorkspaceSynchronizationStatusProvider({
        getSummary: () => {
          const synchronization = requireWorkspaceSynchronizationManager().getStatus();
          return {
            cloudState: synchronization.cloud.state,
            trackedFiles: synchronization.trackedFiles,
            queuedChanges: synchronization.queuedChanges,
            unresolvedConflicts: synchronization.unresolvedConflicts,
            lastBackupAt: synchronization.lastBackupAt,
          };
        },
      });
      planningManager = new CreativePlanningManager();
      await planningManager.initialize(storageRoot, manager);
      reviewManager = new CreativeReviewManager();
      await reviewManager.initialize(storageRoot, manager);
      enterpriseCollaborationManager = new EnterpriseCollaborationManager();
      await enterpriseCollaborationManager.initialize(storageRoot);
      manager.conversationEngine?.setEnterpriseCollaborationStatusProvider({
        getSummary: () => {
          const enterprise = enterpriseCollaborationManager?.getStatus();
          return enterprise ? {
            organizations: enterprise.organizations,
            teams: enterprise.teams,
            users: enterprise.users,
            activeLocks: enterprise.activeLocks,
            activePresence: enterprise.activePresence,
            unreadNotifications: enterprise.unreadNotifications,
          } : null;
        },
      });
      publishingDistributionManager = new PublishingDistributionManager(reviewManager, manager.connectorManager);
      await publishingDistributionManager.initialize(storageRoot);
      manager.conversationEngine?.setPublishingDistributionStatusProvider({
        getSummary: () => {
          const publishing = publishingDistributionManager?.getStatus();
          return publishing ? {
            packages: publishing.packages,
            scheduled: publishing.jobs.scheduled,
            readyLocal: publishing.jobs.readyLocal,
            published: publishing.jobs.published,
            failed: publishing.jobs.failed,
            connectedProfiles: publishing.profiles.connected,
          } : null;
        },
      });
      pipelineManager = new CreativePipelineManager();
      await pipelineManager.initialize(storageRoot, { core: manager, workspace: workspaceManager, planning: planningManager, review: reviewManager });
      manager.conversationEngine?.setExecutionDispatcher({
        dispatch: async (projectId, plan) => ({
          jobId: plan.intent === "marketing"
            ? (await requireMarketingContentManager().start({ projectId })).id
            : plan.intent === "video-generation"
              ? (await requireCommercialVideoManager().start({ projectId })).id
              : plan.intent === "business-intelligence"
                ? (await requireBusinessIntelligenceManager().generateReport("executive")).id
            : (await pipelineManager!.start(projectId)).id,
        }),
      });
      modelManager = manager.modelManager;
      if (!modelManager) throw new Error("AI Model Management is not available");
      manager.conversationEngine?.setRuntimeStatusProvider({
        getSummary: () => {
          const runtime = modelManager?.inference.status();
          if (!runtime) return null;
          const comfy = runtime.providers.find((provider) => provider.kind === "comfyui-video");
          return {
            providers: runtime.providers.map((provider) => ({ name: provider.name, available: provider.available, models: provider.models.length, error: provider.error })),
            gpuName: comfy?.system?.gpuName,
            vramFreeMb: comfy?.system?.vramFreeMb,
          };
        },
      });
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
      productPhotographyManager = new ProductPhotographyManager(workspaceManager, imageGenerationManager, productIntelligenceManager, imageIntelligenceManager, reviewManager);
      await productPhotographyManager.initialize(storageRoot);
        marketingIntelligenceManager = new MarketingIntelligenceManager();
        await marketingIntelligenceManager.initialize(storageRoot, { core: manager, workspace: workspaceManager, products: productIntelligenceManager, images: imageIntelligenceManager });
        if (manager.moduleManager) await manager.moduleManager.registerAndInitialize(createMarketingIntelligencePlugin(marketingIntelligenceManager, manager));
        planningManager.attachMarketingIntelligence(marketingIntelligenceManager);
        marketingContentManager = new MarketingContentManager(workspaceManager, productIntelligenceManager, marketingIntelligenceManager, imageGenerationManager, reviewManager);
        await marketingContentManager.initialize(storageRoot);
        commercialVideoManager = new CommercialVideoManager(workspaceManager, productIntelligenceManager, marketingIntelligenceManager, imageGenerationManager, videoAudioGenerationManager, reviewManager);
        await commercialVideoManager.initialize(storageRoot);
        decisionIntelligenceManager = new DecisionIntelligenceManager();
        await decisionIntelligenceManager.initialize(storageRoot, { core: manager, workspace: workspaceManager, models: modelManager, products: productIntelligenceManager, images: imageIntelligenceManager, marketing: marketingIntelligenceManager });
        if (manager.moduleManager) await manager.moduleManager.registerAndInitialize(createDecisionIntelligencePlugin(decisionIntelligenceManager, manager));
        planningManager.attachDecisionIntelligence(decisionIntelligenceManager);
        businessIntelligenceManager = new BusinessIntelligenceManager(manager, workspaceManager, productIntelligenceManager, marketingIntelligenceManager, decisionIntelligenceManager);
        await businessIntelligenceManager.initialize(storageRoot);
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
        pipelineManager.attachImageGeneration(imageGenerationManager);
        pipelineManager.attachVideoAudioGeneration(videoAudioGenerationManager);
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

      await publishingDistributionManager.processDue();
      publishingScheduleTimer = setInterval(() => {
        void publishingDistributionManager?.processDue().catch(() => undefined);
      }, 60_000);
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
  if (publishingScheduleTimer) {
    clearInterval(publishingScheduleTimer);
    publishingScheduleTimer = null;
  }
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
    commercialVideoManager = null;
    businessIntelligenceManager = null;
    workspaceSynchronizationManager = null;
    enterpriseIntegrationManager = null;
    publishingDistributionManager = null;
    enterpriseCollaborationManager = null;
    generationOptimizationManager = null;
    productIntelligenceManager = null;
    imageIntelligenceManager = null;
    productPhotographyManager = null;
    marketingIntelligenceManager = null;
    marketingContentManager = null;
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

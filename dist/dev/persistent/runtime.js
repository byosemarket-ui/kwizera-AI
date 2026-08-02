import { CreativePlanningManager } from "../../ai/creative-planning/creative-planning-manager.js";
import { CreativePipelineManager } from "../../ai/creative-pipeline/creative-pipeline-manager.js";
import { CreativeReviewManager } from "../../ai/creative-review/creative-review-manager.js";
import { CreativeWorkspaceManager } from "../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageGenerationManager } from "../../ai/image-generation/image-generation-manager.js";
import { createImageGenerationPlugin } from "../../ai/image-generation/image-generation-plugin.js";
import { VideoAudioGenerationManager } from "../../ai/video-audio-generation/video-audio-generation-manager.js";
import { createVideoAudioGenerationPlugin } from "../../ai/video-audio-generation/video-audio-generation-plugin.js";
import { resolveStorageRoot } from "../../storage/paths/storage-paths.js";
import { buildRegistry } from "../server/module-registry.js";
import { DevSessionStore } from "./session-store.js";
import { bootstrapPersistentStorage } from "./storage-bootstrap.js";
let core = null;
let workspaceManager = null;
let planningManager = null;
let reviewManager = null;
let pipelineManager = null;
let modelManager = null;
let imageGenerationManager = null;
let videoAudioGenerationManager = null;
let sessionStore = null;
let status = null;
let autoSaveTimer = null;
let bootPromise = null;
function buildDashboardUrl(host, port) {
    return `http://${host}:${port}`;
}
function countConnectedModules() {
    const phases = buildRegistry();
    const modules = phases.flatMap((p) => p.modules).filter((m) => m.kind !== "blueprint");
    const connected = modules.filter((m) => m.status === "pass" && m.aiPath).length;
    return { total: modules.length, connected, phases: phases.length };
}
async function collectRuntimeSnapshot(manager) {
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
export function getPersistentRuntime() {
    return core;
}
export function getWorkspaceManager() {
    return workspaceManager;
}
export function getPlanningManager() {
    return planningManager;
}
export function getReviewManager() {
    return reviewManager;
}
export function getPipelineManager() {
    return pipelineManager;
}
export function getModelManager() {
    return modelManager;
}
export function getImageGenerationManager() {
    return imageGenerationManager;
}
export function getVideoAudioGenerationManager() {
    return videoAudioGenerationManager;
}
export function getSessionStore() {
    return sessionStore;
}
export function getRuntimeStatus() {
    return status;
}
export function isPersistentMode() {
    return process.env.KWIZERA_PERSISTENT_MODE !== "0";
}
export async function bootPersistentRuntime(host, port) {
    if (bootPromise)
        return bootPromise;
    if (status?.ready)
        return status;
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
            if (!modelManager)
                throw new Error("AI Model Management is not available");
            imageGenerationManager = new ImageGenerationManager();
            await imageGenerationManager.initialize(storageRoot, { core: manager, models: modelManager, workspace: workspaceManager, planning: planningManager });
            if (manager.moduleManager)
                await manager.moduleManager.registerAndInitialize(createImageGenerationPlugin(imageGenerationManager, manager));
            videoAudioGenerationManager = new VideoAudioGenerationManager();
            await videoAudioGenerationManager.initialize(storageRoot, { core: manager, models: modelManager, workspace: workspaceManager, planning: planningManager, images: imageGenerationManager });
            if (manager.moduleManager)
                await manager.moduleManager.registerAndInitialize(createVideoAudioGenerationPlugin(videoAudioGenerationManager, manager));
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
        }
        catch (err) {
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
        }
        finally {
            bootPromise = null;
        }
    })();
    return bootPromise;
}
export async function saveRuntimeSnapshot() {
    if (!core || !sessionStore)
        return;
    try {
        const snapshot = await collectRuntimeSnapshot(core.getManager());
        sessionStore.updateRuntime(snapshot);
        if (status) {
            status.runtime = snapshot;
            status.modules = countConnectedModules();
        }
    }
    catch {
        /* ignore autosave errors */
    }
}
export async function shutdownPersistentRuntime() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
    }
    await saveRuntimeSnapshot();
    sessionStore?.markShutdown();
    if (core) {
        try {
            await core.stop("persistent-dev-shutdown");
        }
        catch {
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
    }
    if (status) {
        status.ready = false;
        status.message = "Shutdown complete — session saved";
    }
}
export function registerShutdownHandlers() {
    const handler = () => {
        void shutdownPersistentRuntime().finally(() => process.exit(0));
    };
    process.on("SIGINT", handler);
    process.on("SIGTERM", handler);
    process.on("beforeExit", () => {
        void saveRuntimeSnapshot();
    });
}
//# sourceMappingURL=runtime.js.map
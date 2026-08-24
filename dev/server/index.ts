import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { spawn } from "node:child_process";

import fs from "node:fs";

import os from "node:os";

import path from "node:path";

import { resolveStorageRoot } from "../../storage/paths/storage-paths.js";
import { probeResourceMetrics } from "../../ai/local-resource-manager/resource-probes.js";

import {

  bootPersistentRuntime,

  getPersistentRuntime,

  getImageGenerationManager,

  getVideoAudioGenerationManager,

  getCommercialVideoManager,

  getBusinessIntelligenceManager,

  getWorkspaceSynchronizationManager,

  getEnterpriseIntegrationManager,

  getPublishingDistributionManager,

  getEnterpriseCollaborationManager,

  getGenerationOptimizationManager,

  getProductIntelligenceManager,

  getImageIntelligenceManager,

  getProductAssetPreparationManager,

  getProductScenePlanningManager,

  getProductStoryboardManager,

  getProductPromptOrchestrationManager,

  getProductImageGenerationManager,

  getProductVideoGenerationManager,

  getProductAudioGenerationManager,

  getProductRenderingExportManager,

  getCreativeGenerationCertificationManager,

  getProductPhotographyManager,

  getMarketingIntelligenceManager,

  getMarketingContentManager,

  getDecisionIntelligenceManager,

  getLearningIntelligenceManager,

  getModelManager,

  getPlanningManager,

  getPipelineManager,

  getReviewManager,

  getRuntimeStatus,

  getSessionStore,

  getWorkspaceManager,

  isPersistentMode,

  registerShutdownHandlers,

  saveRuntimeSnapshot,

  shutdownPersistentRuntime,

} from "../persistent/runtime.js";

import { buildRegistry, findModule, listAiModules, getProjectRoot, invalidateRegistryCache } from "./module-registry.js";

import { PHASE_DEFINITIONS } from "./phase-definitions.js";



const PORT = Number(process.env.KWIZERA_DEV_PORT ?? 5173);

const HOST = "127.0.0.1";

const UI_DIR = path.resolve(import.meta.dirname, "../ui");

const projectRoot = getProjectRoot();

const storageRoot = resolveStorageRoot();

const MAX_REQUEST_BODY_BYTES = 24 * 1024 * 1024;



let activePort = PORT;



console.log("[KWIZERA] Starting persistent local development environment…");

console.log("[KWIZERA] Storage root:", storageRoot);

registerShutdownHandlers();



function sendJson(res: ServerResponse, status: number, data: unknown): void {

  res.writeHead(status, {

    "Content-Type": "application/json",

  });

  res.end(JSON.stringify(data));

}



async function readBody(req: IncomingMessage): Promise<string> {

  return new Promise((resolve, reject) => {

    const chunks: Buffer[] = [];

    let size = 0;

    let rejected = false;

    const contentLength = Number(req.headers["content-length"] ?? 0);

    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {

      reject(new Error("Request body exceeds the 24 MB limit"));

      req.resume();

      return;

    }

    req.on("data", (chunk: Buffer) => {

      if (rejected) return;

      size += chunk.length;

      if (size > MAX_REQUEST_BODY_BYTES) {

        rejected = true;

        reject(new Error("Request body exceeds the 24 MB limit"));

        req.resume();

        return;

      }

      chunks.push(chunk);

    });

    req.on("end", () => { if (!rejected) resolve(Buffer.concat(chunks).toString("utf8")); });

    req.on("error", reject);

  });

}



function contentType(filePath: string): string {

  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";

  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";

  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";

  if (filePath.endsWith(".png")) return "image/png";

  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";

  if (filePath.endsWith(".webp")) return "image/webp";

  if (filePath.endsWith(".svg")) return "image/svg+xml";

  if (filePath.endsWith(".mp4")) return "video/mp4";

  if (filePath.endsWith(".mov")) return "video/quicktime";

  if (filePath.endsWith(".webm")) return "video/webm";

  if (filePath.endsWith(".mkv")) return "video/x-matroska";

  if (filePath.endsWith(".mp3")) return "audio/mpeg";

  if (filePath.endsWith(".wav")) return "audio/wav";

  return "application/octet-stream";

}



async function serveStatic(res: ServerResponse, filePath: string): Promise<void> {

  try {

    const data = await fs.promises.readFile(filePath);

    res.writeHead(200, { "Content-Type": contentType(filePath) });

    res.end(data);

  } catch (error) {

    if ((error as NodeJS.ErrnoException).code === "ENOENT") {

      res.writeHead(404);

      res.end("Not found");

      return;

    }

    res.writeHead(500);

    res.end("Unable to read file");

  }

}

function resolveUiAsset(pathname: string): string | null {

  let decodedPath: string;

  try {

    decodedPath = decodeURIComponent(pathname);

  } catch {

    return null;

  }

  const filePath = path.resolve(UI_DIR, `.${decodedPath}`);

  return filePath === UI_DIR || filePath.startsWith(`${UI_DIR}${path.sep}`) ? filePath : null;

}

function requireWorkspace(res: ServerResponse) {

  const workspace = getWorkspaceManager();

  if (!workspace) {

    sendJson(res, 503, { error: "Creative workspace is restoring. Try again shortly." });

    return null;

  }

  return workspace;

}

function requirePlanning(res: ServerResponse) {

  const planning = getPlanningManager();

  if (!planning) {

    sendJson(res, 503, { error: "Creative planning is restoring. Try again shortly." });

    return null;

  }

  return planning;

}

function requireReview(res: ServerResponse) {

  const review = getReviewManager();

  if (!review) {

    sendJson(res, 503, { error: "Creative review is restoring. Try again shortly." });

    return null;

  }

  return review;

}

function requirePipeline(res: ServerResponse) {

  const pipeline = getPipelineManager();

  if (!pipeline) {

    sendJson(res, 503, { error: "Creative pipeline is restoring. Try again shortly." });

    return null;

  }

  return pipeline;

}

function requireModelManager(res: ServerResponse) {

  const models = getModelManager();

  if (!models) {

    sendJson(res, 503, { error: "AI Model Management is restoring. Try again shortly." });

    return null;

  }

  return models;

}

function requireImageGeneration(res: ServerResponse) {

  const images = getImageGenerationManager();

  if (!images) {

    sendJson(res, 503, { error: "Image generation is restoring. Try again shortly." });

    return null;

  }

  return images;

}

function requireVideoAudioGeneration(res: ServerResponse) {

  const videoAudio = getVideoAudioGenerationManager();

  if (!videoAudio) {

    sendJson(res, 503, { error: "Video and audio generation is restoring. Try again shortly." });

    return null;

  }

  return videoAudio;

}

function requireCommercialVideo(res: ServerResponse) {

  const commercial = getCommercialVideoManager();

  if (!commercial) {

    sendJson(res, 503, { error: "Commercial video is restoring. Try again shortly." });

    return null;

  }

  return commercial;

}

function requireBusinessIntelligence(res: ServerResponse) {

  const business = getBusinessIntelligenceManager();

  if (!business) {

    sendJson(res, 503, { error: "Business intelligence is restoring. Try again shortly." });

    return null;

  }

  return business;

}

function requireWorkspaceSynchronization(res: ServerResponse) {

  const synchronization = getWorkspaceSynchronizationManager();

  if (!synchronization) {

    sendJson(res, 503, { error: "Workspace synchronization is restoring. Try again shortly." });

    return null;

  }

  return synchronization;

}

function requireEnterpriseIntegration(res: ServerResponse) {

  const integration = getEnterpriseIntegrationManager();

  if (!integration) {

    sendJson(res, 503, { error: "Enterprise integration services are restoring. Try again shortly." });

    return null;

  }

  return integration;

}

function requirePublishingDistribution(res: ServerResponse) {

  const publishing = getPublishingDistributionManager();

  if (!publishing) {

    sendJson(res, 503, { error: "Publishing distribution services are restoring. Try again shortly." });

    return null;

  }

  return publishing;

}

function requireEnterpriseCollaboration(res: ServerResponse) {

  const enterprise = getEnterpriseCollaborationManager();

  if (!enterprise) {

    sendJson(res, 503, { error: "Enterprise collaboration services are restoring. Try again shortly." });

    return null;

  }

  return enterprise;

}

function requireGenerationOptimization(res: ServerResponse) {

  const optimization = getGenerationOptimizationManager();

  if (!optimization) {

    sendJson(res, 503, { error: "Generation optimization is restoring. Try again shortly." });

    return null;

  }

  return optimization;

}

function requireProductIntelligence(res: ServerResponse) {

  const intelligence = getProductIntelligenceManager();

  if (!intelligence) {

    sendJson(res, 503, { error: "Product intelligence is restoring. Try again shortly." });

    return null;

  }

  return intelligence;

}

function requireImageIntelligence(res: ServerResponse) {

  const intelligence = getImageIntelligenceManager();

  if (!intelligence) {

    sendJson(res, 503, { error: "Image intelligence is restoring. Try again shortly." });

    return null;

  }

  return intelligence;

}

function requireProductAssetPreparation(res: ServerResponse) {

  const preparation = getProductAssetPreparationManager();

  if (!preparation) {

    sendJson(res, 503, { error: "Product asset preparation is restoring. Try again shortly." });

    return null;

  }

  return preparation;

}

function requireProductScenePlanning(res: ServerResponse) {

  const planning = getProductScenePlanningManager();

  if (!planning) {

    sendJson(res, 503, { error: "Product scene planning is restoring. Try again shortly." });

    return null;

  }

  return planning;

}

function requireProductStoryboard(res: ServerResponse) {

  const storyboard = getProductStoryboardManager();

  if (!storyboard) {

    sendJson(res, 503, { error: "Product storyboard is restoring. Try again shortly." });

    return null;

  }

  return storyboard;

}

function requireProductPromptOrchestration(res: ServerResponse) {

  const orchestration = getProductPromptOrchestrationManager();

  if (!orchestration) {

    sendJson(res, 503, { error: "Product prompt orchestration is restoring. Try again shortly." });

    return null;

  }

  return orchestration;

}

function requireProductImageGeneration(res: ServerResponse) {

  const generation = getProductImageGenerationManager();

  if (!generation) {

    sendJson(res, 503, { error: "Product image generation is restoring. Try again shortly." });

    return null;

  }

  return generation;

}

function requireProductVideoGeneration(res: ServerResponse) {

  const generation = getProductVideoGenerationManager();

  if (!generation) {

    sendJson(res, 503, { error: "Product video generation is restoring. Try again shortly." });

    return null;

  }

  return generation;

}

function requireProductAudioGeneration(res: ServerResponse) {

  const generation = getProductAudioGenerationManager();

  if (!generation) {

    sendJson(res, 503, { error: "Product audio generation is restoring. Try again shortly." });

    return null;

  }

  return generation;

}

function requireCreativeGenerationCertification(res: ServerResponse) {

  const certification = getCreativeGenerationCertificationManager();

  if (!certification) {

    sendJson(res, 503, { error: "Creative Generation Certification runtime is not ready" });

    return null;

  }

  return certification;

}

function requireProductRenderingExport(res: ServerResponse) {

  const rendering = getProductRenderingExportManager();

  if (!rendering) {

    sendJson(res, 503, { error: "Product rendering and export is restoring. Try again shortly." });

    return null;

  }

  return rendering;

}

function requireProductPhotography(res: ServerResponse) {

  const photography = getProductPhotographyManager();

  if (!photography) {

    sendJson(res, 503, { error: "Product photography is restoring. Try again shortly." });

    return null;

  }

  return photography;

}

function requireMarketingIntelligence(res: ServerResponse) {

  const intelligence = getMarketingIntelligenceManager();

  if (!intelligence) {

    sendJson(res, 503, { error: "Marketing intelligence is restoring. Try again shortly." });

    return null;

  }

  return intelligence;

}

function requireMarketingContent(res: ServerResponse) {

  const content = getMarketingContentManager();

  if (!content) {

    sendJson(res, 503, { error: "Marketing content is restoring. Try again shortly." });

    return null;

  }

  return content;

}

function requireDecisionIntelligence(res: ServerResponse) {

  const intelligence = getDecisionIntelligenceManager();

  if (!intelligence) {

    sendJson(res, 503, { error: "Decision intelligence is restoring. Try again shortly." });

    return null;

  }

  return intelligence;

}

function requireLearningIntelligence(res: ServerResponse) {

  const learning = getLearningIntelligenceManager();

  if (!learning) {

    sendJson(res, 503, { error: "AI learning intelligence is restoring. Try again shortly." });

    return null;

  }

  return learning;

}



function createIsolatedStorageRoot(): string {

  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-"));

}



function cleanupTemp(dir: string): void {

  try {

    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

  } catch { /* ignore */ }

}



function pathToFileUrl(filePath: string): string {

  return `file:///${path.resolve(filePath).replace(/\\/g, "/")}`;

}



async function runSmokeTest(aiPath: string) {

  const start = Date.now();

  const distJs = path.join(projectRoot, "dist", aiPath, "index.js");

  const srcTs = path.join(projectRoot, aiPath, "index.ts");

  const target = fs.existsSync(distJs) ? distJs : srcTs;



  if (!fs.existsSync(target)) {

    return { success: false, durationMs: Date.now() - start, message: `Module not found: ${aiPath}`, output: "" };

  }



  try {

    const mod = await import(pathToFileUrl(target));

    const exportCount = Object.keys(mod).length;

    return {

      success: exportCount > 0,

      durationMs: Date.now() - start,

      message: `Module loaded (${exportCount} exports)`,

      output: `Loaded ${fs.existsSync(distJs) ? "dist" : "source"}/${aiPath}`,

    };

  } catch (err) {

    const message = err instanceof Error ? err.message : String(err);

    return { success: false, durationMs: Date.now() - start, message, output: message };

  }

}



async function runValidationScript(validateKey: string) {

  const start = Date.now();

  const isolatedRoot = createIsolatedStorageRoot();

  return new Promise<{ success: boolean; durationMs: number; message: string; output: string }>((resolve) => {

    const child = spawn(

      process.platform === "win32" ? "npm.cmd" : "npm",

      ["run", `validate:${validateKey}`],

      { cwd: projectRoot, env: { ...process.env, KWIZERA_STORAGE_ROOT: isolatedRoot }, shell: true }

    );

    let output = "";

    child.stdout.on("data", (d: Buffer) => { output += d.toString(); });

    child.stderr.on("data", (d: Buffer) => { output += d.toString(); });

    child.on("close", (code) => {

      cleanupTemp(isolatedRoot);

      resolve({

        success: code === 0,

        durationMs: Date.now() - start,

        message: code === 0 ? "Validation passed" : `Validation failed (exit ${code})`,

        output: output.slice(-8000),

      });

    });

    child.on("error", (err) => {

      cleanupTemp(isolatedRoot);

      resolve({ success: false, durationMs: Date.now() - start, message: err.message, output });

    });

  });

}



async function runEngineQuickTest(engineName: string) {

  const start = Date.now();

  const persistentCore = getPersistentRuntime();



  if (persistentCore?.getManager().isReady()) {

    const manager = persistentCore.getManager();

    const health = manager.controller.getHealthReport();

    const report = persistentCore.getStatusReport();

    const success = health.healthy && report.readinessScore >= 80;

    return {

      success,

      durationMs: Date.now() - start,

      message: `${engineName}: persistent runtime readiness ${report.readinessScore}/100`,

      output: JSON.stringify({

        mode: "persistent",

        storageRoot,

        healthy: health.healthy,

        readinessScore: report.readinessScore,

        lifecycle: manager.getLifecycleState(),

      }, null, 2),

    };

  }



  const isolatedRoot = createIsolatedStorageRoot();

  try {

    const { createAiCore } = await import("../../ai/core/index.js");

    const core = createAiCore({ storageRootOverride: isolatedRoot });

    await core.start("dev-quick-test");

    const health = core.getManager().controller.getHealthReport();

    const report = core.getStatusReport();

    await core.stop("dev quick test");

    cleanupTemp(isolatedRoot);

    const success = health.healthy && report.readinessScore >= 80;

    return {

      success,

      durationMs: Date.now() - start,

      message: `${engineName}: readiness ${report.readinessScore}/100`,

      output: JSON.stringify({ mode: "isolated", healthy: health.healthy, readinessScore: report.readinessScore }, null, 2),

    };

  } catch (err) {

    cleanupTemp(isolatedRoot);

    const message = err instanceof Error ? err.message : String(err);

    return { success: false, durationMs: Date.now() - start, message, output: message };

  }

}



async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {

  if (req.method === "OPTIONS") {

    res.writeHead(204);

    res.end();

    return;

  }



  if (url.pathname === "/api/health") {

    const runtime = getRuntimeStatus();

    sendJson(res, 200, {

      ok: true,

      name: "KWIZERA AI STUDIO",

      mode: isPersistentMode() ? "persistent-local-development" : "local-development",

      host: HOST,

      port: activePort,

      storageRoot,

      persistent: isPersistentMode(),

      runtimeReady: runtime?.ready ?? false,

      sessionRestored: runtime?.restored ?? false,

    });

    return;

  }

  if (url.pathname === "/api/desktop-workspace/status") {

    const runtime = getPersistentRuntime()?.getManager();
    const activeProject = await getWorkspaceManager()?.getActiveProject();
    const pipeline = getPipelineManager()?.getDashboard();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const resources = probeResourceMetrics(resolveStorageRoot());
    const activeJobs = pipeline?.jobs.filter((job) => job.status === "queued" || job.status === "running").length ?? 0;

    sendJson(res, 200, {

      aiCore: Boolean(runtime?.isReady()),

      workflowEngine: Boolean(runtime?.workflowEngine),

      communicationBus: Boolean(runtime?.communicationBus),

      moduleManager: Boolean(runtime?.moduleManager),

      memoryFoundation: Boolean(runtime?.memoryFoundation),

      knowledgeFoundation: Boolean(runtime?.knowledgeFoundation),

      automationEngine: Boolean(runtime?.workflowEngine),

      taskScheduler: Boolean(runtime?.taskManager),

      productIntelligence: Boolean(runtime?.productIntelligenceFoundation),

      cameraSimulation: Boolean(runtime?.videoIntelligenceFoundation),

      activeProject: activeProject?.name ?? "No active project",
      activeProjectId: activeProject?.id ?? null,
      runtimeMetrics: {
        memoryMb: Math.round(memoryUsage.rss / 1024 / 1024),
        cpuUserMs: Math.round(cpuUsage.user / 1000),
        gpu: resources.gpuMemoryTotalMb
          ? `${resources.gpuUsage}% · ${resources.gpuMemoryUsedMb ?? 0}/${resources.gpuMemoryTotalMb} MB`
          : resources.source === "heuristic"
            ? `heuristic ${resources.gpuUsage}%`
            : "unavailable",
        activeJobs,
        cpuUsage: resources.cpuUsage,
        gpuUsage: resources.gpuUsage,
        ramUsage: resources.ramUsage,
        ramTotalMb: resources.systemRamTotalMb,
        vramUsage: resources.vramUsage,
        diskUsage: resources.diskUsage,
        diskUsedGb: resources.storageUsedGb,
        diskTotalGb: resources.storageTotalGb,
        activeAiModels: activeJobs > 0 ? Math.min(activeJobs, 3) : 0,
      },

    });

    return;

  }



  if (url.pathname === "/api/session") {

    const store = getSessionStore();

    const runtime = getRuntimeStatus();

    sendJson(res, 200, {

      session: store?.get() ?? null,

      runtime,

    });

    return;

  }

  if (url.pathname === "/api/conversations" && req.method === "GET") {
    const conversations = getPersistentRuntime()?.getManager().conversationEngine;
    if (!conversations) { sendJson(res, 503, { error: "Conversation engine is restoring. Try again shortly." }); return; }
    sendJson(res, 200, { conversations: conversations.list() });
    return;
  }

  if (url.pathname === "/api/conversations" && req.method === "POST") {
    const conversations = getPersistentRuntime()?.getManager().conversationEngine;
    if (!conversations) { sendJson(res, 503, { error: "Conversation engine is restoring. Try again shortly." }); return; }
    try {
      const body = JSON.parse(await readBody(req)) as { conversationId?: string; message?: string; projectId?: string };
      sendJson(res, 201, await conversations.respond({ conversationId: body.conversationId, message: body.message ?? "", projectId: body.projectId }));
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to process conversation" });
    }
    return;
  }

  if (url.pathname === "/api/workspace") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    const activeProject = await workspace.getActiveProject();

    sendJson(res, 200, {

      activeProject,

      projects: await workspace.listProjects(),

      validation: workspace.validate(activeProject),

      integrations: workspace.getIntegrationStatus(),

    });

    return;

  }

  if (url.pathname === "/api/pipeline") {

    const pipeline = requirePipeline(res);

    if (!pipeline) return;

    sendJson(res, 200, pipeline.getDashboard());

    return;

  }

  if (url.pathname === "/api/models") {

    const models = requireModelManager(res);

    if (!models) return;

    sendJson(res, 200, await models.dashboard());

    return;

  }

  if (url.pathname === "/api/models/runtime" && req.method === "GET") {

    const models = requireModelManager(res);

    if (!models) return;

    sendJson(res, 200, await models.runtimeStatus());

    return;

  }

  if (url.pathname === "/api/models/discover" && req.method === "POST") {

    const models = requireModelManager(res);

    if (!models) return;

    try {

      sendJson(res, 200, await models.discoverProviders());

    } catch (error) {

      sendJson(res, 503, { error: error instanceof Error ? error.message : "Unable to discover local inference providers" });

    }

    return;

  }

  if (url.pathname === "/api/models/providers" && req.method === "POST") {

    const models = requireModelManager(res);

    if (!models) return;

    try {

      const body = JSON.parse(await readBody(req));

      models.inference.configure(body);

      sendJson(res, 201, await models.runtimeStatus());

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to configure local inference provider" });

    }

    return;

  }

  if (url.pathname === "/api/image-generation") {

    const images = requireImageGeneration(res);

    if (!images) return;

    sendJson(res, 200, await images.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/product-photography" && req.method === "GET") {

    const photography = requireProductPhotography(res);

    if (!photography) return;

    sendJson(res, 200, { jobs: photography.list(url.searchParams.get("projectId") ?? undefined) });

    return;

  }

  if (url.pathname === "/api/product-photography/jobs" && req.method === "POST") {

    const photography = requireProductPhotography(res);

    if (!photography) return;

    try {

      const job = await photography.start(JSON.parse(await readBody(req)));

      sendJson(res, job.status === "completed" ? 201 : 422, { job });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Product photography generation failed" });

    }

    return;

  }

  if (url.pathname === "/api/video-audio-generation") {

    const videoAudio = requireVideoAudioGeneration(res);

    if (!videoAudio) return;

    sendJson(res, 200, await videoAudio.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/commercial-video" && req.method === "GET") {

    const commercial = requireCommercialVideo(res);

    if (!commercial) return;

    sendJson(res, 200, { jobs: commercial.list(url.searchParams.get("projectId") ?? undefined) });

    return;

  }

  if (url.pathname === "/api/commercial-video/jobs" && req.method === "POST") {

    const commercial = requireCommercialVideo(res);

    if (!commercial) return;

    try {

      const job = await commercial.start(JSON.parse(await readBody(req)));

      sendJson(res, job.status === "completed" ? 201 : 422, { job });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Commercial video generation failed" });

    }

    return;

  }

  if (url.pathname === "/api/business-intelligence" && req.method === "GET") {

    const business = requireBusinessIntelligence(res);

    if (!business) return;

    sendJson(res, 200, await business.getDashboard());

    return;

  }

  if (url.pathname === "/api/workspace-synchronization" && req.method === "GET") {

    const synchronization = requireWorkspaceSynchronization(res);

    if (!synchronization) return;

    sendJson(res, 200, { status: synchronization.getStatus(), queue: synchronization.getQueuedChanges(), conflicts: synchronization.getConflicts() });

    return;

  }

  if (url.pathname === "/api/enterprise-integrations" && req.method === "GET") {

    const integration = requireEnterpriseIntegration(res);

    if (!integration) return;

    sendJson(res, 200, { status: integration.getStatus(), routes: integration.listRoutes(), webhooks: integration.listWebhooks() });

    return;

  }

  if (url.pathname === "/api/publishing-distribution" && req.method === "GET") {

    const publishing = requirePublishingDistribution(res);

    if (!publishing) return;

    sendJson(res, 200, { status: publishing.getStatus(), profiles: publishing.listProfiles(), packages: publishing.listPackages().map(({ packagePath, metadataPath, ...publishingPackage }) => publishingPackage), jobs: publishing.listJobs() });

    return;

  }

  if (url.pathname === "/api/enterprise-collaboration" && req.method === "GET") {

    const enterprise = requireEnterpriseCollaboration(res);

    if (!enterprise) return;

    sendJson(res, 200, { status: enterprise.getStatus(), organizations: enterprise.listOrganizations().map(({ ownerId, ...organization }) => organization) });

    return;

  }

  if (url.pathname === "/api/workspace-synchronization/snapshot" && req.method === "POST") {

    const synchronization = requireWorkspaceSynchronization(res);

    if (!synchronization) return;

    try {

      sendJson(res, 201, { entries: await synchronization.snapshotLocalWorkspace(), status: synchronization.getStatus() });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Workspace snapshot failed" });

    }

    return;

  }

  if (url.pathname === "/api/workspace-synchronization/backup" && req.method === "POST") {

    const synchronization = requireWorkspaceSynchronization(res);

    if (!synchronization) return;

    try {

      sendJson(res, 201, await synchronization.createBackup());

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Workspace backup failed" });

    }

    return;

  }

  if (url.pathname === "/api/workspace-synchronization/restore" && req.method === "POST") {

    const synchronization = requireWorkspaceSynchronization(res);

    if (!synchronization) return;

    try {

      const body = JSON.parse(await readBody(req)) as { backupId?: unknown };

      if (typeof body.backupId !== "string" || !body.backupId.trim()) throw new Error("A backup id is required");

      sendJson(res, 200, await synchronization.restoreBackup(body.backupId));

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Workspace restore failed" });

    }

    return;

  }

  if (url.pathname === "/api/workspace-synchronization/synchronize" && req.method === "POST") {

    const synchronization = requireWorkspaceSynchronization(res);

    if (!synchronization) return;

    sendJson(res, 200, await synchronization.synchronize());

    return;

  }

  if (url.pathname === "/api/business-intelligence/sales" && req.method === "POST") {

    const business = requireBusinessIntelligence(res);

    if (!business) return;

    try {

      sendJson(res, 201, { imported: await business.recordSales(JSON.parse(await readBody(req))) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Sales import failed" });

    }

    return;

  }

  if (url.pathname === "/api/business-intelligence/inventory" && req.method === "POST") {

    const business = requireBusinessIntelligence(res);

    if (!business) return;

    try {

      sendJson(res, 201, { imported: await business.upsertInventory(JSON.parse(await readBody(req))) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Inventory import failed" });

    }

    return;

  }

  if (url.pathname === "/api/business-intelligence/marketing" && req.method === "POST") {

    const business = requireBusinessIntelligence(res);

    if (!business) return;

    try {

      sendJson(res, 201, { imported: await business.recordMarketing(JSON.parse(await readBody(req))) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Marketing import failed" });

    }

    return;

  }

  if (url.pathname === "/api/business-intelligence/reports" && req.method === "POST") {

    const business = requireBusinessIntelligence(res);

    if (!business) return;

    try {

      const body = JSON.parse(await readBody(req));

      sendJson(res, 201, await business.generateReport(body.kind));

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Business report generation failed" });

    }

    return;

  }

  if (url.pathname === "/api/business-intelligence/exports" && req.method === "POST") {

    const business = requireBusinessIntelligence(res);

    if (!business) return;

    try {

      const body = JSON.parse(await readBody(req));

      sendJson(res, 201, await business.exportReport(body.kind, body.format));

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Business report export failed" });

    }

    return;

  }

  if (url.pathname.startsWith("/api/business-intelligence/exports/") && req.method === "GET") {

    const business = requireBusinessIntelligence(res);

    if (!business) return;

    const filePath = await business.getExportPath(url.pathname.slice("/api/business-intelligence/exports/".length));

    if (!filePath) { sendJson(res, 404, { error: "Business export not found" }); return; }

    await serveStatic(res, filePath);

    return;

  }

  if (url.pathname === "/api/generation-optimization") {

    const optimization = requireGenerationOptimization(res);

    if (!optimization) return;

    sendJson(res, 200, await optimization.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/generation-optimization/production" && req.method === "GET") {

    const optimization = requireGenerationOptimization(res);

    if (!optimization) return;

    sendJson(res, 200, await optimization.refreshProduction());

    return;

  }

  if (url.pathname === "/api/product-intelligence") {

    const intelligence = requireProductIntelligence(res);

    if (!intelligence) return;

    sendJson(res, 200, await intelligence.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/image-intelligence") {

    const intelligence = requireImageIntelligence(res);

    if (!intelligence) return;

    sendJson(res, 200, await intelligence.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/product-asset-preparation") {

    const preparation = requireProductAssetPreparation(res);

    if (!preparation) return;

    sendJson(res, 200, await preparation.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/product-scene-planning") {

    const planning = requireProductScenePlanning(res);

    if (!planning) return;

    sendJson(res, 200, await planning.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/product-storyboard") {

    const storyboard = requireProductStoryboard(res);

    if (!storyboard) return;

    sendJson(res, 200, await storyboard.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/product-prompt-orchestration") {

    const orchestration = requireProductPromptOrchestration(res);

    if (!orchestration) return;

    sendJson(res, 200, await orchestration.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/product-image-generation") {

    const generation = requireProductImageGeneration(res);

    if (!generation) return;

    sendJson(res, 200, await generation.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/product-video-generation") {

    const generation = requireProductVideoGeneration(res);

    if (!generation) return;

    sendJson(res, 200, await generation.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/product-audio-generation") {

    const generation = requireProductAudioGeneration(res);

    if (!generation) return;

    sendJson(res, 200, await generation.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/product-rendering-export") {

    const rendering = requireProductRenderingExport(res);

    if (!rendering) return;

    sendJson(res, 200, await rendering.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/creative-generation-certification") {

    const certification = requireCreativeGenerationCertification(res);

    if (!certification) return;

    sendJson(res, 200, await certification.getDashboard());

    return;

  }

  if (url.pathname === "/api/marketing-intelligence") {

    const intelligence = requireMarketingIntelligence(res);

    if (!intelligence) return;

    sendJson(res, 200, await intelligence.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/marketing-content" && req.method === "GET") {

    const content = requireMarketingContent(res);

    if (!content) return;

    sendJson(res, 200, { jobs: content.list(url.searchParams.get("projectId") ?? undefined) });

    return;

  }

  if (url.pathname === "/api/marketing-content/jobs" && req.method === "POST") {

    const content = requireMarketingContent(res);

    if (!content) return;

    try {

      const job = await content.start(JSON.parse(await readBody(req)));

      sendJson(res, job.status === "completed" ? 201 : 422, { job });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Marketing content generation failed" });

    }

    return;

  }

  if (url.pathname === "/api/decision-intelligence") {

    const intelligence = requireDecisionIntelligence(res);

    if (!intelligence) return;

    sendJson(res, 200, await intelligence.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  if (url.pathname === "/api/learning-intelligence") {

    const learning = requireLearningIntelligence(res);

    if (!learning) return;

    sendJson(res, 200, await learning.getDashboard(url.searchParams.get("projectId") ?? undefined));

    return;

  }

  const imageAnalysisMatch = url.pathname.match(/^\/api\/image-intelligence\/projects\/([^/]+)\/analyze$/);

  if (imageAnalysisMatch && req.method === "POST") {

    const intelligence = requireImageIntelligence(res);

    if (!intelligence) return;

    try {

      const profiles = await intelligence.analyzeProject(imageAnalysisMatch[1]);

      sendJson(res, 201, { profiles, dashboard: await intelligence.getDashboard(imageAnalysisMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Image analysis failed" });

    }

    return;

  }

  const imageOverrideMatch = url.pathname.match(/^\/api\/image-intelligence\/projects\/([^/]+)\/images\/([^/]+)\/view-role$/);

  if (imageOverrideMatch && req.method === "POST") {

    const intelligence = requireImageIntelligence(res);

    if (!intelligence) return;

    try {

      const body = JSON.parse(await readBody(req)) as { viewRole?: string; confidence?: number };

      if (!body.viewRole) { sendJson(res, 400, { error: "viewRole is required" }); return; }

      const profile = await intelligence.overrideViewRole(

        imageOverrideMatch[1],

        imageOverrideMatch[2],

        body.viewRole,

        typeof body.confidence === "number" ? body.confidence : 1,

      );

      sendJson(res, 200, { profile, dashboard: await intelligence.getDashboard(imageOverrideMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to override view role" });

    }

    return;

  }

  const productAssetPrepareMatch = url.pathname.match(/^\/api\/product-asset-preparation\/projects\/([^/]+)\/prepare$/);

  if (productAssetPrepareMatch && req.method === "POST") {

    const preparation = requireProductAssetPreparation(res);

    if (!preparation) return;

    try {

      const result = await preparation.prepareProductAssets(productAssetPrepareMatch[1]);

      sendJson(res, 201, { result, dashboard: await preparation.getDashboard(productAssetPrepareMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Product asset preparation failed" });

    }

    return;

  }

  const productScenePlanMatch = url.pathname.match(/^\/api\/product-scene-planning\/projects\/([^/]+)\/plan$/);

  if (productScenePlanMatch && req.method === "POST") {

    const planning = requireProductScenePlanning(res);

    if (!planning) return;

    try {

      const result = await planning.planProductScenes(productScenePlanMatch[1]);

      sendJson(res, 201, { result, dashboard: await planning.getDashboard(productScenePlanMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Product scene planning failed" });

    }

    return;

  }

  const productStoryboardMatch = url.pathname.match(/^\/api\/product-storyboard\/projects\/([^/]+)\/generate$/);

  if (productStoryboardMatch && req.method === "POST") {

    const storyboard = requireProductStoryboard(res);

    if (!storyboard) return;

    try {

      const result = await storyboard.generateStoryboardAndScript(productStoryboardMatch[1]);

      sendJson(res, 201, { result, dashboard: await storyboard.getDashboard(productStoryboardMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Product storyboard generation failed" });

    }

    return;

  }

  const productPromptOrchestrationMatch = url.pathname.match(/^\/api\/product-prompt-orchestration\/projects\/([^/]+)\/orchestrate$/);

  if (productPromptOrchestrationMatch && req.method === "POST") {

    const orchestration = requireProductPromptOrchestration(res);

    if (!orchestration) return;

    try {

      const result = await orchestration.orchestratePromptsAndModels(productPromptOrchestrationMatch[1]);

      sendJson(res, 201, { result, dashboard: await orchestration.getDashboard(productPromptOrchestrationMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Product prompt orchestration failed" });

    }

    return;

  }

  const productImageGenerationMatch = url.pathname.match(/^\/api\/product-image-generation\/projects\/([^/]+)\/generate$/);

  if (productImageGenerationMatch && req.method === "POST") {

    const generation = requireProductImageGeneration(res);

    if (!generation) return;

    try {

      const result = await generation.generateProductSceneImages(productImageGenerationMatch[1]);

      sendJson(res, 201, { result, dashboard: await generation.getDashboard(productImageGenerationMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Product image generation failed" });

    }

    return;

  }

  const productVideoGenerationMatch = url.pathname.match(/^\/api\/product-video-generation\/projects\/([^/]+)\/generate$/);

  if (productVideoGenerationMatch && req.method === "POST") {

    const generation = requireProductVideoGeneration(res);

    if (!generation) return;

    try {

      const result = await generation.generateProductSceneVideos(productVideoGenerationMatch[1]);

      sendJson(res, 201, { result, dashboard: await generation.getDashboard(productVideoGenerationMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Product video generation failed" });

    }

    return;

  }

  const productAudioGenerationMatch = url.pathname.match(/^\/api\/product-audio-generation\/projects\/([^/]+)\/generate$/);

  if (productAudioGenerationMatch && req.method === "POST") {

    const generation = requireProductAudioGeneration(res);

    if (!generation) return;

    try {

      const result = await generation.generateProductAudio(productAudioGenerationMatch[1]);

      sendJson(res, 201, { result, dashboard: await generation.getDashboard(productAudioGenerationMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Product audio generation failed" });

    }

    return;

  }

  const productRenderingExportMatch = url.pathname.match(/^\/api\/product-rendering-export\/projects\/([^/]+)\/render$/);

  if (productRenderingExportMatch && req.method === "POST") {

    const rendering = requireProductRenderingExport(res);

    if (!rendering) return;

    try {

      const result = await rendering.renderAndPackage(productRenderingExportMatch[1]);

      sendJson(res, 201, { result, dashboard: await rendering.getDashboard(productRenderingExportMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Product rendering and export failed" });

    }

    return;

  }

  if (url.pathname === "/api/creative-generation-certification/certify" && req.method === "POST") {

    const certification = requireCreativeGenerationCertification(res);

    if (!certification) return;

    try {

      const body = JSON.parse((await readBody(req)) || "{}") as { autoRepair?: boolean; kinds?: Array<"shoe" | "bag" | "phone" | "watch"> };

      const result = await certification.certify({
        autoRepair: body?.autoRepair !== false,
        kinds: body?.kinds,
      });

      sendJson(res, 201, { result, dashboard: await certification.getDashboard(), explanation: await certification.explainCertification() });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Creative Generation Certification failed" });

    }

    return;

  }

  const productAnalysisMatch = url.pathname.match(/^\/api\/product-intelligence\/projects\/([^/]+)\/analyze$/);

  if (productAnalysisMatch && req.method === "POST") {

    const intelligence = requireProductIntelligence(res);

    if (!intelligence) return;

    try {

      const profile = await intelligence.analyze(productAnalysisMatch[1]);

      sendJson(res, 201, { profile, dashboard: await intelligence.getDashboard(productAnalysisMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Product analysis failed" });

    }

    return;

  }

  const marketingAnalysisMatch = url.pathname.match(/^\/api\/marketing-intelligence\/projects\/([^/]+)\/analyze$/);

  if (marketingAnalysisMatch && req.method === "POST") {

    const intelligence = requireMarketingIntelligence(res);

    if (!intelligence) return;

    try {

      const profile = await intelligence.analyze(marketingAnalysisMatch[1]);

      sendJson(res, 201, { profile, dashboard: await intelligence.getDashboard(marketingAnalysisMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Marketing analysis failed" });

    }

    return;

  }

  const decisionAnalysisMatch = url.pathname.match(/^\/api\/decision-intelligence\/projects\/([^/]+)\/decide$/);

  if (decisionAnalysisMatch && req.method === "POST") {

    const intelligence = requireDecisionIntelligence(res);

    if (!intelligence) return;

    try {

      const body = (await readBody(req)) || "{}";

      const decision = await intelligence.decide(decisionAnalysisMatch[1], JSON.parse(body).taskKind ?? "pipeline");

      sendJson(res, 201, { decision, dashboard: await intelligence.getDashboard(decisionAnalysisMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Decision analysis failed" });

    }

    return;

  }

  const learningProjectMatch = url.pathname.match(/^\/api\/learning-intelligence\/projects\/([^/]+)\/learn$/);

  if (learningProjectMatch && req.method === "POST") {

    const learning = requireLearningIntelligence(res);

    if (!learning) return;

    try {

      const body = JSON.parse((await readBody(req)) || "{}");

      const profile = await learning.learnFromProject(learningProjectMatch[1], body.outcome ?? "success", body.detail);

      sendJson(res, 201, { profile, dashboard: await learning.getDashboard(learningProjectMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Learning collection failed" });

    }

    return;

  }

  const learningFeedbackMatch = url.pathname.match(/^\/api\/learning-intelligence\/projects\/([^/]+)\/feedback$/);

  if (learningFeedbackMatch && req.method === "POST") {

    const learning = requireLearningIntelligence(res);

    if (!learning) return;

    try {

      const body = JSON.parse((await readBody(req)) || "{}");

      const profile = await learning.recordFeedback(learningFeedbackMatch[1], String(body.feedback ?? ""));

      sendJson(res, 201, { profile, dashboard: await learning.getDashboard(learningFeedbackMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Feedback learning failed" });

    }

    return;

  }

  if (url.pathname === "/api/generation-optimization/optimize" && req.method === "POST") {

    const optimization = requireGenerationOptimization(res);

    if (!optimization) return;

    try {

      const request = JSON.parse(await readBody(req));

      const task = await optimization.optimize(request);

      sendJson(res, 201, { task, dashboard: await optimization.getDashboard(request.projectId) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Optimization task failed" });

    }

    return;

  }

  if (url.pathname === "/api/generation-optimization/batch" && req.method === "POST") {

    const optimization = requireGenerationOptimization(res);

    if (!optimization) return;

    try {

      const body = JSON.parse(await readBody(req));

      const tasks = await optimization.batch.submit(body.requests ?? []);

      sendJson(res, 201, { tasks, dashboard: await optimization.getDashboard(body.projectId) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Optimization batch failed" });

    }

    return;

  }

  if (url.pathname === "/api/generation-optimization/production/recover" && req.method === "POST") {

    const optimization = requireGenerationOptimization(res);

    if (!optimization) return;

    try {

      const recovery = await optimization.recoverProduction();

      sendJson(res, 200, { recovery, production: optimization.production.getDashboard() });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Production recovery failed" });

    }

    return;

  }

  const optimizationRetryMatch = url.pathname.match(/^\/api\/generation-optimization\/tasks\/([^/]+)\/retry$/);

  if (optimizationRetryMatch && req.method === "POST") {

    const optimization = requireGenerationOptimization(res);

    if (!optimization) return;

    try {

      const task = await optimization.retry(optimizationRetryMatch[1]);

      sendJson(res, 200, { task, dashboard: await optimization.getDashboard(task.request.projectId) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Optimization retry failed" });

    }

    return;

  }

  const videoDefaultMatch = url.pathname.match(/^\/api\/video-audio-generation\/projects\/([^/]+)\/default$/);

  if (videoDefaultMatch && req.method === "GET") {

    const videoAudio = requireVideoAudioGeneration(res);

    if (!videoAudio) return;

    try {

      sendJson(res, 200, { request: await videoAudio.defaultRequest(videoDefaultMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to prepare video defaults" });

    }

    return;

  }

  if (url.pathname === "/api/video-audio-generation/generate" && req.method === "POST") {

    const videoAudio = requireVideoAudioGeneration(res);

    if (!videoAudio) return;

    try {

      const body = JSON.parse(await readBody(req));

      const generated = await videoAudio.generate(body);

      sendJson(res, 201, { package: generated, dashboard: await videoAudio.getDashboard(body.projectId) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Video and audio generation failed" });

    }

    return;

  }

  const videoAssetMatch = url.pathname.match(/^\/api\/video-audio-generation\/packages\/([^/]+)\/(preview|audio|subtitles)$/);

  if (videoAssetMatch && req.method === "GET") {

    const videoAudio = requireVideoAudioGeneration(res);

    if (!videoAudio) return;

    const filePath = await videoAudio.getAssetPath(videoAssetMatch[1], videoAssetMatch[2] as "preview" | "audio" | "subtitles");

    if (!filePath) { sendJson(res, 404, { error: "Generated video package asset not found" }); return; }

    await serveStatic(res, filePath);

    return;

  }

  const imageDefaultMatch = url.pathname.match(/^\/api\/image-generation\/projects\/([^/]+)\/default$/);

  if (imageDefaultMatch && req.method === "GET") {

    const images = requireImageGeneration(res);

    if (!images) return;

    try {

      sendJson(res, 200, { request: await images.defaultRequest(imageDefaultMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to prepare generation defaults" });

    }

    return;

  }

  if (url.pathname === "/api/image-generation/generate" && req.method === "POST") {

    const images = requireImageGeneration(res);

    if (!images) return;

    try {

      const body = JSON.parse(await readBody(req));

      const generated = await images.generate(body);

      sendJson(res, 201, { images: generated, dashboard: await images.getDashboard(body.projectId) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Image generation failed" });

    }

    return;

  }

  const generatedAssetMatch = url.pathname.match(/^\/api\/image-generation\/assets\/([^/]+)$/);

  if (generatedAssetMatch && req.method === "GET") {

    const images = requireImageGeneration(res);

    if (!images) return;

    const filePath = await images.getAssetPath(generatedAssetMatch[1]);

    if (!filePath) { sendJson(res, 404, { error: "Generated image not found" }); return; }

    await serveStatic(res, filePath);

    return;

  }

  if (url.pathname === "/api/models/settings" && req.method === "POST") {

    const models = requireModelManager(res);

    if (!models) return;

    try {

      const body = JSON.parse(await readBody(req));

      sendJson(res, 200, { settings: await models.settings.update(body) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to update model settings" });

    }

    return;

  }

  if (url.pathname === "/api/models/infer" && req.method === "POST") {

    const models = requireModelManager(res);

    if (!models) return;

    try {

      const body = JSON.parse(await readBody(req));

      sendJson(res, 200, { result: await models.inference.infer(body), runtime: models.inference.status() });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Local inference failed" });

    }

    return;

  }

  if (url.pathname === "/api/models/health" && req.method === "POST") {

    const models = requireModelManager(res);

    if (!models) return;

    await models.health.scan();

    sendJson(res, 200, await models.dashboard());

    return;

  }

  const modelActionMatch = url.pathname.match(/^\/api\/models\/([^/]+)\/(install|load|unload|update|remove|validate)$/);

  if (modelActionMatch && req.method === "POST") {

    const models = requireModelManager(res);

    if (!models) return;

    try {

      const body = JSON.parse(await readBody(req)) as { sourcePath?: string; version?: string };

      const [, modelId, action] = modelActionMatch;

      if (action === "install") await models.installer.install(modelId, body.sourcePath);
      else if (action === "load") await models.loader.load(modelId);
      else if (action === "unload") await models.loader.unload(modelId);
      else if (action === "update") await models.updates.update(modelId, body.version ?? "");
      else if (action === "remove") await models.remove(modelId);
      else await models.validation.validate(models.getMutable(modelId));

      sendJson(res, 200, await models.dashboard());

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to manage model" });

    }

    return;

  }

  if (url.pathname === "/api/pipeline/jobs" && req.method === "POST") {

    const pipeline = requirePipeline(res);

    if (!pipeline) return;

    try {

      const body = JSON.parse(await readBody(req)) as { projectId?: string };

      if (!body.projectId) { sendJson(res, 400, { error: "projectId is required" }); return; }

      const job = await pipeline.enqueue(body.projectId);

      sendJson(res, 202, { job, dashboard: pipeline.getDashboard() });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to queue creative pipeline" });

    }

    return;

  }

  if (url.pathname === "/api/autonomous-executions" && req.method === "POST") {

    const pipeline = requirePipeline(res);

    if (!pipeline) return;

    try {

      const body = JSON.parse(await readBody(req)) as { projectId?: string };

      if (!body.projectId) { sendJson(res, 400, { error: "projectId is required" }); return; }

      const job = await pipeline.start(body.projectId);

      sendJson(res, 202, { job, dashboard: pipeline.getDashboard() });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to start autonomous execution" });

    }

    return;

  }

  const autonomousExecutionMatch = url.pathname.match(/^\/api\/autonomous-executions\/([^/]+)(?:\/(pause|resume|cancel))?$/);

  if (autonomousExecutionMatch) {

    const pipeline = requirePipeline(res);

    if (!pipeline) return;

    const [, jobId, action] = autonomousExecutionMatch;

    try {

      if (req.method === "GET" && !action) {
        const job = pipeline.getJob(jobId);
        if (!job) { sendJson(res, 404, { error: "Autonomous execution not found" }); return; }
        sendJson(res, 200, { job, dashboard: pipeline.getDashboard() });
        return;
      }

      if (req.method === "POST" && action) {
        const job = action === "pause" ? await pipeline.pause(jobId) : action === "resume" ? await pipeline.resume(jobId) : await pipeline.cancel(jobId);
        sendJson(res, 200, { job, dashboard: pipeline.getDashboard() });
        return;
      }

      sendJson(res, 405, { error: "Method not allowed" });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to control autonomous execution" });

    }

    return;

  }

  const pipelineRetryMatch = url.pathname.match(/^\/api\/pipeline\/jobs\/([^/]+)\/retry$/);

  if (pipelineRetryMatch && req.method === "POST") {

    const pipeline = requirePipeline(res);

    if (!pipeline) return;

    try {

      const job = await pipeline.retry(pipelineRetryMatch[1]);

      sendJson(res, 200, { job, dashboard: pipeline.getDashboard() });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to retry creative pipeline" });

    }

    return;

  }

  const pipelineArtifactMatch = url.pathname.match(/^\/api\/pipeline\/projects\/([^/]+)\/artifacts$/);

  if (pipelineArtifactMatch && req.method === "POST") {

    const review = requireReview(res);

    if (!review) return;

    try {

      const body = JSON.parse(await readBody(req)) as { name?: string; mimeType?: string; dataBase64?: string };

      const asset = await review.ingestAsset(pipelineArtifactMatch[1], { name: body.name ?? "Generated asset", mimeType: body.mimeType ?? "", dataBase64: body.dataBase64 ?? "" });

      sendJson(res, 201, { asset, review: await review.getProjectState(pipelineArtifactMatch[1]) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to register generated artifact" });

    }

    return;

  }

  const reviewMatch = url.pathname.match(/^\/api\/review\/projects\/([^/]+)$/);

  if (reviewMatch && req.method === "GET") {

    const review = requireReview(res);

    if (!review) return;

    sendJson(res, 200, { review: await review.getProjectState(reviewMatch[1]), integrations: review.getIntegrationStatus() });

    return;

  }

  const reviewAssetMatch = url.pathname.match(/^\/api\/review\/projects\/([^/]+)\/assets\/([^/]+)$/);

  if (reviewAssetMatch && req.method === "GET") {

    const review = requireReview(res);

    if (!review) return;

    const filePath = await review.getAssetPath(reviewAssetMatch[1], reviewAssetMatch[2]);

    if (!filePath) { sendJson(res, 404, { error: "Review asset not found" }); return; }

    await serveStatic(res, filePath);

    return;

  }

  const downloadMatch = url.pathname.match(/^\/api\/review\/projects\/([^/]+)\/downloads\/([^/]+)$/);

  if (downloadMatch && req.method === "GET") {

    const review = requireReview(res);

    if (!review) return;

    const filePath = await review.getAssetPath(downloadMatch[1], decodeURIComponent(downloadMatch[2]), true);

    if (!filePath) { sendJson(res, 404, { error: "Export not found" }); return; }

    await serveStatic(res, filePath);

    return;

  }

  const reviewActionMatch = url.pathname.match(/^\/api\/review\/projects\/([^/]+)\/(bootstrap|assets|approve|regenerate|export)$/);

  if (reviewActionMatch && req.method === "POST") {

    const review = requireReview(res);

    if (!review) return;

    try {

      const projectId = reviewActionMatch[1];

      const action = reviewActionMatch[2];

      const body = JSON.parse(await readBody(req)) as Record<string, string>;

      if (action === "bootstrap") {

        const workspace = requireWorkspace(res);

        if (!workspace) return;

        const project = await workspace.getProject(projectId);

        if (!project) { sendJson(res, 404, { error: "Project not found" }); return; }

        const images = await Promise.all(project.productImages.map(async (image) => {

          const imagePath = await workspace.getImagePath(projectId, image.url.split("/").pop() ?? "");

          return imagePath ? { name: image.fileName, mimeType: image.mimeType, dataBase64: fs.readFileSync(imagePath).toString("base64") } : null;

        }));

        sendJson(res, 200, { review: await review.bootstrapProductImages(project, images.filter((image): image is NonNullable<typeof image> => image !== null)) });

      } else if (action === "assets") {

        const asset = await review.ingestAsset(projectId, { name: body.name ?? "Generated asset", mimeType: body.mimeType ?? "", dataBase64: body.dataBase64 ?? "" });

        sendJson(res, 201, { asset, review: await review.getProjectState(projectId) });

      } else if (action === "approve") {

        const asset = await review.approve(projectId, body.assetId ?? "");

        sendJson(res, 200, { asset, review: await review.getProjectState(projectId) });

      } else if (action === "regenerate") {

        sendJson(res, 202, { review: await review.requestRegeneration(projectId, body.assetId ?? "", body.instructions) });

      } else {

        const result = await review.exportAsset(projectId, body.assetId ?? "", { format: body.format as never, platform: body.platform ?? "instagram", resolution: body.resolution ?? "source", quality: body.quality ?? "high" });

        sendJson(res, 200, result);

      }

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to process review action" });

    }

    return;

  }

  const planMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/plan$/);

  if (planMatch && req.method === "GET") {

    const planning = requirePlanning(res);

    if (!planning) return;

    sendJson(res, 200, { plan: await planning.getPlan(planMatch[1]), integrations: planning.getIntegrationStatus() });

    return;

  }

  if (planMatch && req.method === "POST") {

    const planning = requirePlanning(res);

    const workspace = requireWorkspace(res);

    if (!planning || !workspace) return;

    try {

      const body = JSON.parse(await readBody(req)) as { action?: string; changes?: Record<string, unknown> };

      if (body.action === "generate") {

        const project = await workspace.getProject(planMatch[1]);

        if (!project) { sendJson(res, 404, { error: "Project not found" }); return; }

        const result = await planning.createPlan(project, workspace.validate(project));

        if (!result.plan) { sendJson(res, 422, { error: "Complete required workspace inputs before planning.", validation: result.validation }); return; }

        sendJson(res, 201, result);

      } else {

        const plan = await planning.updatePlan(planMatch[1], body.changes ?? {});

        sendJson(res, 200, { plan });

      }

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to save creative plan" });

    }

    return;

  }

  if (url.pathname === "/api/workspace/projects" && req.method === "POST") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    try {

      const body = JSON.parse(await readBody(req)) as { name?: string };

      const project = await workspace.createProject(body.name ?? "");

      sendJson(res, 201, { project, validation: workspace.validate(project) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to create project" });

    }

    return;

  }

  const projectMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)$/);

  if (projectMatch && req.method === "GET") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    const project = await workspace.getProject(projectMatch[1]);

    if (!project) { sendJson(res, 404, { error: "Project not found" }); return; }

    sendJson(res, 200, { project, validation: workspace.validate(project) });

    return;

  }

  if (projectMatch && req.method === "POST") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    try {

      const body = JSON.parse(await readBody(req)) as { action?: string; changes?: Record<string, unknown> };

      const project = body.action === "open"

        ? await workspace.openProject(projectMatch[1])

        : await workspace.updateProject(projectMatch[1], body.changes ?? {});

      sendJson(res, 200, { project, validation: workspace.validate(project) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to save project" });

    }

    return;

  }

  const imageMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/images\/([^/]+)$/);

  if (imageMatch && req.method === "GET") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    const imagePath = await workspace.getImagePath(imageMatch[1], imageMatch[2]);

    if (!imagePath) { sendJson(res, 404, { error: "Product image not found" }); return; }

    await serveStatic(res, imagePath);

    return;

  }

  const uploadMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/images$/);

  if (uploadMatch && req.method === "POST") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    try {

      const body = JSON.parse(await readBody(req)) as { fileName?: string; mimeType?: string; dataBase64?: string };

      const image = await workspace.uploadImage(uploadMatch[1], {

        fileName: body.fileName ?? "product-image",

        mimeType: body.mimeType ?? "",

        dataBase64: body.dataBase64 ?? "",

        width: typeof body.width === "number" ? body.width : undefined,

        height: typeof body.height === "number" ? body.height : undefined,

        checksumSha256: typeof body.checksumSha256 === "string" ? body.checksumSha256 : undefined,

      });

      const project = await workspace.getProject(uploadMatch[1]);

      sendJson(res, 201, { image, project, validation: workspace.validate(project), intake: workspace.validateIntake(project) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to upload image" });

    }

    return;

  }

  const removeImageMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/images\/([^/]+)$/);

  if (removeImageMatch && req.method === "DELETE") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    try {

      const project = await workspace.removeImage(removeImageMatch[1], removeImageMatch[2]);

      sendJson(res, 200, { project, validation: workspace.validate(project), intake: workspace.validateIntake(project) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to remove image" });

    }

    return;

  }



  if (url.pathname === "/api/session/ui" && req.method === "POST") {

    const store = getSessionStore();

    if (!store) {

      sendJson(res, 503, { error: "Session store not ready" });

      return;

    }

    try {

      const body = JSON.parse(await readBody(req)) as { filter?: string; openPhases?: string[] };

      store.updateUi({

        filter: body.filter ?? store.get().ui.filter,

        openPhases: body.openPhases ?? store.get().ui.openPhases,

      });

      sendJson(res, 200, { ok: true, ui: store.get().ui });

    } catch {

      sendJson(res, 400, { error: "Invalid session UI payload" });

    }

    return;

  }



  if (url.pathname === "/api/runtime") {

    sendJson(res, 200, { runtime: getRuntimeStatus() });

    return;

  }



  if (url.pathname === "/api/phases") {

    const refresh = url.searchParams.get("refresh") === "1";

    sendJson(res, 200, { phases: buildRegistry(refresh) });

    return;

  }



  if (url.pathname === "/api/engines") {

    sendJson(res, 200, {

      engines: PHASE_DEFINITIONS.filter((p) => p.phase > 1).map((p) => ({

        id: p.id, phase: p.phase, name: p.engine, description: p.description,

      })),

    });

    return;

  }



  if (url.pathname === "/api/modules/ai") {

    const modules = listAiModules();

    sendJson(res, 200, { modules, count: modules.length });

    return;

  }



  if (url.pathname === "/api/logo") {

    await serveStatic(res, path.join(projectRoot, "KWIZERA AI.png"));

    return;

  }



  const engineMatch = url.pathname.match(/^\/api\/engines\/([^/]+)\/quick-test$/);

  if (req.method === "POST" && engineMatch) {

    const phase = PHASE_DEFINITIONS.find((p) => p.id === engineMatch[1]);

    if (!phase) { sendJson(res, 404, { error: "Engine not found" }); return; }

    const result = await runEngineQuickTest(phase.engine);

    sendJson(res, 200, result);

    return;

  }



  const smokeMatch = url.pathname.match(/^\/api\/modules\/([^/]+)\/smoke-test$/);

  if (req.method === "POST" && smokeMatch) {

    const mod = findModule(smokeMatch[1]);

    if (!mod?.aiPath) { sendJson(res, 404, { error: "Module not found" }); return; }

    const result = await runSmokeTest(mod.aiPath);

    sendJson(res, 200, result);

    return;

  }



  const validateMatch = url.pathname.match(/^\/api\/modules\/([^/]+)\/validate$/);

  if (req.method === "POST" && validateMatch) {

    const mod = findModule(validateMatch[1]);

    if (!mod?.validateKey) { sendJson(res, 404, { error: "Validation script not found" }); return; }

    const result = await runValidationScript(mod.validateKey);

    if (result.success) invalidateRegistryCache();

    sendJson(res, 200, result);

    return;

  }



  sendJson(res, 404, { error: "Not found" });

}



const server = createServer(async (req, res) => {

  const url = new URL(req.url ?? "/", `http://${HOST}:${activePort}`);



  if (url.pathname.startsWith("/api/")) {

    await handleApi(req, res, url);

    return;

  }



  let filePath = url.pathname === "/" ? path.join(UI_DIR, "index.html") : url.pathname === "/desktop" || url.pathname === "/desktop/" ? path.join(UI_DIR, "desktop", "index.html") : resolveUiAsset(url.pathname);

  if (!filePath) {

    res.writeHead(404);

    res.end("Not found");

    return;

  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {

    filePath = path.join(UI_DIR, "index.html");

  }

  await serveStatic(res, filePath);

});



function openBrowser(address: string): void {

  if (process.env.KWIZERA_SKIP_BROWSER_OPEN === "1") return;

  if (process.platform === "win32") {

    spawn("cmd", ["/c", "start", "chrome", address], { detached: true, stdio: "ignore" }).unref();

  }

}



function printStartupBanner(port: number, restored: boolean): void {

  const address = `http://${HOST}:${port}`;

  console.log("");

  console.log("  KWIZERA AI STUDIO — Persistent Local Development");

  console.log(`  Dashboard: ${address}`);

  console.log(`  Storage:   ${storageRoot}`);

  console.log(`  Session:   ${restored ? "restored from previous run" : "initialized"}`);

  console.log("  Offline only — not deployed");

  console.log("");

  openBrowser(address);

}



function startListening(port: number): void {

  server.once("error", (err: NodeJS.ErrnoException) => {

    if (err.code === "EADDRINUSE") {

      console.error(`[KWIZERA] Port ${port} is already in use.`);

      console.error(`  Stop the other process, or run: $env:KWIZERA_DEV_PORT=5174; npm run dev`);

      process.exit(1);

    }

    console.error("[KWIZERA] Server error:", err);

    process.exit(1);

  });



  server.listen(port, HOST, () => {

    activePort = port;

    const runtime = getRuntimeStatus();

    printStartupBanner(port, runtime?.restored ?? false);



    if (process.env.KWIZERA_AUTO_START === "1") {

      getSessionStore()?.markAutoStart(true);

    }

  });

}



async function main(): Promise<void> {

  process.env.KWIZERA_PERSISTENT_MODE ??= "1";

  process.env.KWIZERA_STORAGE_ROOT ??= storageRoot;



  startListening(PORT);

  void bootPersistentRuntime(HOST, PORT).then((runtime) => {
    console.log(`[KWIZERA] ${runtime.message}`);
    void saveRuntimeSnapshot();
  }).catch((err) => {
    console.error("[KWIZERA] Background runtime boot error:", err);
  });

}



main().catch((err) => {

  console.error("[KWIZERA] Fatal startup error:", err);

  process.exit(1);

});



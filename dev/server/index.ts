import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { spawn } from "node:child_process";

import fs from "node:fs";

import os from "node:os";

import path from "node:path";

import { findProjectRoot, resolveStorageRoot } from "../../storage/paths/storage-paths.js";
import { isProductionEnv, loadProjectEnv, resolveBindHost, resolveBindPort, resolveHealthProbeHost } from "../../config/runtime-env.js";
import { probeResourceMetrics } from "../../ai/local-resource-manager/resource-probes.js";
import { persistentMemoryCenter } from "./persistent-memory-center.js";
import { onlineKnowledgeEngine } from "./online-knowledge-engine.js";
import { systemHealthCenter } from "./system-health-center.js";
import { resolvePublicUiFile } from "./static-ui.js";
import { isVerifiedLive, loadDeploymentRecord } from "./deployment-status.js";
import { CreativeWorkspaceError } from "../../ai/creative-workspace/creative-workspace-manager.js";
import { VideoProductionError } from "../../ai/video-production/types.js";
import { linkProjectFoundation } from "../../ai/creative-workspace/project-foundation-bridge.js";
import { ingestUploadedImage } from "../../ai/image-intelligence/image-ingest.js";

import {

  bootPersistentRuntime,

  getPersistentRuntime,

  getImageGenerationManager,

  getVideoAudioGenerationManager,

  getVideoProductionManager,

  getCommercialVideoManager,

  getBusinessIntelligenceManager,

  getWorkspaceSynchronizationManager,

  getEnterpriseIntegrationManager,

  getPublishingDistributionManager,

  getEnterpriseCollaborationManager,

  getGenerationOptimizationManager,

  getProductIntelligenceManager,

  getCanonicalProductManager,

  getMarketingBriefManager,

  getImageIntelligenceManager,

  getProductAssetPreparationManager,

  getMediaIntelligenceManager,

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

  coreHttpHealth,

  getSessionStore,

  getWorkspaceManager,

  isPersistentMode,

  registerShutdownHandlers,

  saveRuntimeSnapshot,

  shutdownPersistentRuntime,

} from "../persistent/runtime.js";

import { buildRegistry, findModule, listAiModules, getProjectRoot, invalidateRegistryCache } from "./module-registry.js";

import { PHASE_DEFINITIONS } from "./phase-definitions.js";



const projectRoot = getProjectRoot() || findProjectRoot(import.meta.dirname);

loadProjectEnv(projectRoot);

const PORT = resolveBindPort();

const HOST = resolveBindHost();

const UI_DIR = path.join(projectRoot, "dev", "ui");

const storageRoot = resolveStorageRoot();

const MAX_REQUEST_BODY_BYTES = 24 * 1024 * 1024;



let activePort = PORT;



console.log(isProductionEnv()
  ? "[KWIZERA] Starting KWIZERA AI STUDIO production runtime…"
  : "[KWIZERA] Starting persistent local development environment…");

console.log("[KWIZERA] Storage root:", storageRoot);
console.log("[KWIZERA] Studio UI:", path.join(UI_DIR, "desktop", "index.html"),
  fs.existsSync(path.join(UI_DIR, "desktop", "index.html")) ? "(present)" : "MISSING — run npm run build:production");

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



async function serveStatic(res: ServerResponse, filePath: string, method: string = "GET"): Promise<void> {
  try {
    const stat = await fs.promises.stat(filePath);
    const headers = {
      "Content-Type": contentType(filePath),
      "Content-Length": String(stat.size),
    };
    if (method === "HEAD") {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    const data = await fs.promises.readFile(filePath);
    res.writeHead(200, headers);
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

function requireWorkspace(res: ServerResponse) {

  const workspace = getWorkspaceManager();

  if (!workspace) {

    const runtime = getRuntimeStatus();
    const detail = runtime?.booting
      ? "Creative workspace is still starting. Wait a moment and try again."
      : "Creative workspace is unavailable. Restart KWIZERA AI STUDIO and try Create Project again.";
    sendJson(res, 503, { error: detail });

    return null;

  }

  return workspace;

}

function sendWorkspaceError(res: ServerResponse, error: unknown): void {
  if (error instanceof CreativeWorkspaceError) {
    sendJson(res, error.httpStatus, { error: error.message, code: error.code });
    return;
  }
  sendJson(res, 400, { error: error instanceof Error ? error.message : "Workspace request failed" });
}

function sendVideoProductionError(res: ServerResponse, error: unknown): void {
  if (error instanceof VideoProductionError) {
    sendJson(res, error.httpStatus, { error: error.message, code: error.code });
    return;
  }
  sendJson(res, 400, { error: error instanceof Error ? error.message : "Video production request failed" });
}

async function withFoundation(
  workspace: NonNullable<ReturnType<typeof getWorkspaceManager>>,
  project: NonNullable<Awaited<ReturnType<NonNullable<ReturnType<typeof getWorkspaceManager>>["getActiveProject"]>>>,
  reason: "create" | "open" | "asset",
) {
  try {
    const manager = getPersistentRuntime()?.getManager();
    const foundation = await linkProjectFoundation(project, manager, reason);
    return await workspace.updateProject(project.id, { foundation });
  } catch {
    return project;
  }
}

function requirePlanning(res: ServerResponse) {

  const planning = getPlanningManager();

  if (!planning) {

    sendJson(res, 503, { error: "Creative planning is restoring. Try again shortly." });

    return null;

  }

  return planning;

}

function requireVideoProduction(res: ServerResponse) {
  const manager = getVideoProductionManager();
  if (!manager) {
    sendJson(res, 503, { error: "Video production is restoring. Try again shortly." });
    return null;
  }
  return manager;
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

function requireCanonicalProduct(res: ServerResponse) {
  const manager = getCanonicalProductManager();
  if (!manager) {
    sendJson(res, 503, { error: "Product record is restoring. Try again shortly." });
    return null;
  }
  return manager;
}

function requireMarketingBrief(res: ServerResponse) {
  const manager = getMarketingBriefManager();
  if (!manager) {
    sendJson(res, 503, { error: "Marketing production brief is restoring. Try again shortly." });
    return null;
  }
  return manager;
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

function requireMediaIntelligence(res: ServerResponse) {

  const media = getMediaIntelligenceManager();

  if (!media) {

    sendJson(res, 503, { error: "Media intelligence is restoring. Try again shortly." });

    return null;

  }

  return media;

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

    const health = coreHttpHealth(getRuntimeStatus());

    sendJson(res, 200, {

      ok: health.status !== "unhealthy",

      status: health.status,

      name: "KWIZERA AI STUDIO",

      mode: isProductionEnv()
        ? "production"
        : isPersistentMode()
          ? "persistent-local-development"
          : "local-development",

      host: HOST,

      port: activePort,

      storageRoot,

      persistent: isPersistentMode(),

      runtimeReady: health.runtimeReady,

      sessionRestored: health.sessionRestored,

      message: health.message,

      architecture: "kwizera-ai-core",

    });

    return;

  }

  if (url.pathname === "/api/deployment") {
    const record = loadDeploymentRecord(storageRoot, projectRoot, isProductionEnv());
    sendJson(res, 200, {
      ...record,
      verifiedLive: isVerifiedLive(record),
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

      localInference: Boolean(getModelManager()?.isInitialized()),

      memoryFoundation: Boolean(runtime?.memoryFoundation),

      knowledgeFoundation: Boolean(runtime?.knowledgeFoundation),

      productIntelligence: Boolean(runtime?.productIntelligenceFoundation),

      imageIntelligence: Boolean(runtime?.imageIntelligenceFoundation),

      videoIntelligence: Boolean(runtime?.videoIntelligenceFoundation),

      workflowEngine: Boolean(runtime?.workflowEngine),

      communicationBus: Boolean(runtime?.communicationBus),

      moduleManager: Boolean(runtime?.moduleManager),

      automationEngine: Boolean(runtime?.workflowEngine),

      taskScheduler: Boolean(runtime?.taskManager),

      cameraSimulation: Boolean(runtime?.videoIntelligenceFoundation),

      foundation: "kwizera-ai-core",

      activeProject: activeProject?.name ?? "",
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

  // ——— Phase 7 Step 2: Persistent Memory & Local Knowledge Center ———
  if (url.pathname === "/api/persistent-memory/health") {
    sendJson(res, 200, persistentMemoryCenter.health());
    return;
  }

  if (url.pathname === "/api/persistent-memory/search" && req.method === "GET") {
    if (!persistentMemoryCenter.isReady()) {
      sendJson(res, 503, { error: persistentMemoryCenter.getBootError() ?? "Memory center starting" });
      return;
    }
    try {
      const text = url.searchParams.get("q") ?? url.searchParams.get("text") ?? undefined;
      const kind = url.searchParams.get("kind") as import("./persistent-memory-center.js").StudioMemoryKind | null;
      const projectId = url.searchParams.get("projectId") ?? undefined;
      const limit = Number(url.searchParams.get("limit") ?? 40);
      const records = await persistentMemoryCenter.searchMemory({
        text,
        kind: kind ?? undefined,
        projectId,
        limit,
      });
      sendJson(res, 200, { records, count: records.length });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Search failed" });
    }
    return;
  }

  if (url.pathname === "/api/persistent-memory/save" && req.method === "POST") {
    if (!persistentMemoryCenter.isReady()) {
      sendJson(res, 503, { error: persistentMemoryCenter.getBootError() ?? "Memory center starting" });
      return;
    }
    try {
      const body = JSON.parse(await readBody(req));
      const result = await persistentMemoryCenter.saveMemory(body);
      sendJson(res, result.success || result.action === "updated" ? 200 : 400, result);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Save failed" });
    }
    return;
  }

  if (url.pathname.startsWith("/api/persistent-memory/record/") && req.method === "GET") {
    if (!persistentMemoryCenter.isReady()) {
      sendJson(res, 503, { error: "Memory center starting" });
      return;
    }
    const memoryId = decodeURIComponent(url.pathname.replace("/api/persistent-memory/record/", ""));
    if (!memoryId || memoryId.includes("..")) {
      sendJson(res, 400, { error: "Invalid memory id" });
      return;
    }
    const result = await persistentMemoryCenter.getMemory(memoryId);
    sendJson(res, result.success ? 200 : 404, result);
    return;
  }

  if (url.pathname === "/api/persistent-knowledge/search" && req.method === "GET") {
    if (!persistentMemoryCenter.isReady()) {
      sendJson(res, 503, { error: "Memory center starting" });
      return;
    }
    try {
      const records = await persistentMemoryCenter.searchKnowledge({
        text: url.searchParams.get("q") ?? undefined,
        topic: url.searchParams.get("topic") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 40),
        projectId: url.searchParams.get("projectId") ?? undefined,
        permanentOnly: url.searchParams.get("permanentOnly") === "1" ? true
          : url.searchParams.get("projectId") ? false : true,
      });
      sendJson(res, 200, { records, count: records.length });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Knowledge search failed" });
    }
    return;
  }

  if (url.pathname === "/api/knowledge/teach" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as {
        topic?: string;
        content?: string;
        scope?: "permanent" | "project";
        projectId?: string;
        knowledgeType?: string;
        autoApprove?: boolean;
        sourceName?: string;
      };
      const foundation = getPersistentRuntime()?.getManager()?.knowledgeFoundation;
      if (foundation?.isStartupComplete()) {
        const { createKnowledgeTeachingService } = await import("../../ai/knowledge-foundation/knowledge-teaching-service.js");
        const teaching = createKnowledgeTeachingService(foundation);
        const taught = await teaching.teach({
          topic: body.topic ?? "",
          content: body.content ?? "",
          scope: body.scope ?? "permanent",
          projectId: body.projectId,
          autoApprove: body.autoApprove !== false,
          sourceName: body.sourceName,
          knowledgeType: body.knowledgeType as never,
        });
        sendJson(res, taught.ok ? 200 : 400, { foundation: "kwizera-ai-core", ...taught });
        return;
      }
      // Fallback: Persistent Memory Center (same knowledge disk) when AI Core still booting
      if (!persistentMemoryCenter.isReady()) {
        sendJson(res, 503, { error: "Knowledge teaching unavailable until Knowledge Foundation or Memory Center is ready" });
        return;
      }
      const saved = await persistentMemoryCenter.saveKnowledge({
        title: `Taught: ${body.topic ?? "knowledge"}`,
        topic: body.topic ?? "",
        content: body.content ?? "",
        scope: body.scope ?? "permanent",
        projectId: body.projectId,
        source: body.sourceName ?? "kwizera-teaching",
      });
      sendJson(res, saved.success || saved.action === "updated" ? 200 : 400, {
        foundation: "persistent-memory-center",
        ok: Boolean(saved.success || saved.action === "updated"),
        knowledgeId: saved.knowledgeId,
        imported: Boolean(saved.success || saved.action === "updated"),
        scope: body.scope ?? "permanent",
        projectId: body.projectId,
        error: saved.success || saved.action === "updated" ? undefined : (saved as { validation?: { message?: string } }).validation?.message,
      });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Knowledge teaching failed" });
    }
    return;
  }

  if (url.pathname === "/api/knowledge/retrieve" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as {
        text?: string;
        projectId?: string;
        includePermanent?: boolean;
        permanentOnly?: boolean;
        limit?: number;
        verifiedOnly?: boolean;
      };
      const foundation = getPersistentRuntime()?.getManager()?.knowledgeFoundation;
      if (foundation?.isStartupComplete()) {
        const { createKnowledgeTeachingService } = await import("../../ai/knowledge-foundation/knowledge-teaching-service.js");
        const teaching = createKnowledgeTeachingService(foundation);
        const retrieved = await teaching.retrieve({
          text: body.text ?? "",
          projectId: body.projectId,
          includePermanent: body.includePermanent,
          permanentOnly: body.permanentOnly,
          limit: body.limit,
          verifiedOnly: body.verifiedOnly,
        });
        sendJson(res, retrieved.ok ? 200 : 400, { foundation: "kwizera-ai-core", ...retrieved });
        return;
      }
      if (!persistentMemoryCenter.isReady()) {
        sendJson(res, 503, { error: "Knowledge retrieval unavailable" });
        return;
      }
      const records = await persistentMemoryCenter.searchKnowledge({
        text: body.text,
        projectId: body.projectId,
        permanentOnly: body.projectId ? false : body.permanentOnly !== false,
        limit: body.limit ?? 20,
      });
      sendJson(res, 200, {
        foundation: "persistent-memory-center",
        ok: true,
        records,
        knowledgeIds: records.map((r) => r.knowledgeId),
        count: records.length,
      });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Knowledge retrieval failed" });
    }
    return;
  }

  if (url.pathname === "/api/knowledge/approve" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as {
        requestId?: string;
        scope?: "permanent" | "project";
        projectId?: string;
      };
      const foundation = getPersistentRuntime()?.getManager()?.knowledgeFoundation;
      if (!foundation?.isStartupComplete()) {
        sendJson(res, 503, { error: "Knowledge Foundation not ready for approve" });
        return;
      }
      if (!body.requestId) {
        sendJson(res, 400, { error: "requestId is required" });
        return;
      }
      const { createKnowledgeTeachingService } = await import("../../ai/knowledge-foundation/knowledge-teaching-service.js");
      const teaching = createKnowledgeTeachingService(foundation);
      const approved = await teaching.approve(body.requestId, { scope: body.scope, projectId: body.projectId });
      sendJson(res, approved.ok ? 200 : 400, { foundation: "kwizera-ai-core", ...approved });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Knowledge approve failed" });
    }
    return;
  }

  if (url.pathname === "/api/persistent-knowledge/save" && req.method === "POST") {
    if (!persistentMemoryCenter.isReady()) {
      sendJson(res, 503, { error: "Memory center starting" });
      return;
    }
    try {
      const body = JSON.parse(await readBody(req));
      const result = await persistentMemoryCenter.saveKnowledge(body);
      sendJson(res, result.success || result.action === "updated" ? 200 : 400, result);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Knowledge save failed" });
    }
    return;
  }

  if (url.pathname === "/api/persistent-memory/context" && req.method === "POST") {
    if (!persistentMemoryCenter.isReady()) {
      sendJson(res, 503, { error: "Memory center starting" });
      return;
    }
    try {
      const body = JSON.parse((await readBody(req)) || "{}") as { projectId?: string; task?: string; limit?: number };
      const ctx = await persistentMemoryCenter.buildContext(body);
      sendJson(res, 200, ctx);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Context build failed" });
    }
    return;
  }

  if (url.pathname === "/api/persistent-memory/checkpoint" && req.method === "POST") {
    if (!persistentMemoryCenter.isReady()) {
      sendJson(res, 503, { error: "Memory center starting" });
      return;
    }
    try {
      const body = JSON.parse(await readBody(req)) as { label?: string; data?: Record<string, unknown> };
      const result = persistentMemoryCenter.writeCheckpoint(body.label ?? "manual", body.data ?? {});
      sendJson(res, 201, result);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Checkpoint failed" });
    }
    return;
  }

  if (url.pathname === "/api/persistent-memory/checkpoints" && req.method === "GET") {
    if (!persistentMemoryCenter.isReady()) {
      sendJson(res, 503, { error: "Memory center starting" });
      return;
    }
    sendJson(res, 200, { checkpoints: persistentMemoryCenter.listCheckpoints() });
    return;
  }

  if (url.pathname === "/api/persistent-memory/backup" && req.method === "POST") {
    if (!persistentMemoryCenter.isReady()) {
      sendJson(res, 503, { error: "Memory center starting" });
      return;
    }
    sendJson(res, 201, persistentMemoryCenter.createBackup());
    return;
  }

  if (url.pathname === "/api/persistent-memory/backups" && req.method === "GET") {
    sendJson(res, 200, { backups: persistentMemoryCenter.listBackups() });
    return;
  }

  if (url.pathname === "/api/persistent-memory/restore" && req.method === "POST") {
    if (!persistentMemoryCenter.isReady()) {
      sendJson(res, 503, { error: "Memory center starting" });
      return;
    }
    try {
      const body = JSON.parse(await readBody(req)) as { backupId?: string; confirm?: boolean };
      if (!body.backupId) {
        sendJson(res, 400, { error: "backupId required" });
        return;
      }
      const result = persistentMemoryCenter.restoreBackup(body.backupId, Boolean(body.confirm));
      if (result.ok) {
        await persistentMemoryCenter.reboundAfterRestore();
      }
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Restore failed" });
    }
    return;
  }

  // ---- Phase 7 Step 3 — Online Knowledge Acquisition ----
  if (url.pathname === "/api/online-knowledge/status" && req.method === "GET") {
    sendJson(res, 200, onlineKnowledgeEngine.getStatus());
    return;
  }

  if (url.pathname === "/api/online-knowledge/network" && req.method === "GET") {
    sendJson(res, 200, await onlineKnowledgeEngine.refreshNetwork());
    return;
  }

  if (url.pathname === "/api/online-knowledge/history" && req.method === "GET") {
    sendJson(res, 200, { history: onlineKnowledgeEngine.listHistory() });
    return;
  }

  if (url.pathname === "/api/online-knowledge/refresh-queue" && req.method === "GET") {
    sendJson(res, 200, { queue: onlineKnowledgeEngine.listRefreshQueue() });
    return;
  }

  if (url.pathname === "/api/online-knowledge/refresh-queue" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as { knowledgeId?: string; topic?: string };
      if (!body.knowledgeId || !body.topic) {
        sendJson(res, 400, { error: "knowledgeId and topic required" });
        return;
      }
      onlineKnowledgeEngine.enqueueRefresh(body.knowledgeId, body.topic);
      sendJson(res, 201, { ok: true, queue: onlineKnowledgeEngine.listRefreshQueue() });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Queue failed" });
    }
    return;
  }

  if (url.pathname === "/api/online-knowledge/research" && req.method === "POST") {
    if (!onlineKnowledgeEngine.isReady()) {
      sendJson(res, 503, { error: "Online knowledge engine starting" });
      return;
    }
    try {
      const body = JSON.parse(await readBody(req)) as {
        query?: string;
        topic?: string;
        domain?: string;
        persist?: boolean;
        maxSources?: number;
        freshnessRequirement?: "any" | "current" | "recent";
      };
      if (!body.query?.trim()) {
        sendJson(res, 400, { error: "query required" });
        return;
      }
      const result = await onlineKnowledgeEngine.research({
        query: body.query,
        topic: body.topic,
        domain: body.domain as import("./online-knowledge-engine.js").KnowledgeDomain | undefined,
        persist: body.persist,
        maxSources: body.maxSources,
        freshnessRequirement: body.freshnessRequirement,
      });
      sendJson(res, result.ok ? 200 : 422, result);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Research failed" });
    }
    return;
  }

  if (url.pathname === "/api/online-knowledge/retrieve-local" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as { query?: string; limit?: number };
      const records = await onlineKnowledgeEngine.retrieveLocal(body.query ?? "", body.limit ?? 10);
      sendJson(res, 200, { records, count: records.length, mode: "OFFLINE_KNOWLEDGE" });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Retrieve failed" });
    }
    return;
  }

  // ---- Phase 7 Step 4 — System Health / Windows Integration ----
  if (url.pathname === "/api/system-health" && req.method === "GET") {
    if (!systemHealthCenter.isReady()) {
      sendJson(res, 503, { error: "System health center starting" });
      return;
    }
    sendJson(res, 200, await systemHealthCenter.runFastHealthCheck());
    return;
  }

  if (url.pathname === "/api/system-health/full" && req.method === "GET") {
    if (!systemHealthCenter.isReady()) {
      sendJson(res, 503, { error: "System health center starting" });
      return;
    }
    sendJson(res, 200, await systemHealthCenter.runFullDiagnostic());
    return;
  }

  if (url.pathname === "/api/system-health/self-test" && req.method === "POST") {
    sendJson(res, 200, await systemHealthCenter.selfTest());
    return;
  }

  if (url.pathname === "/api/system-health/services" && req.method === "GET") {
    sendJson(res, 200, { services: systemHealthCenter.listServices() });
    return;
  }

  if (url.pathname === "/api/system-health/repair" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as {
        action?: import("./system-health-center.js").AllowedRepairAction;
        component?: string;
        level?: import("./system-health-center.js").RepairLevel;
        problem?: string;
      };
      if (!body.action) {
        sendJson(res, 400, { error: "action required (allowlisted only)" });
        return;
      }
      const entry = await systemHealthCenter.repair({
        action: body.action,
        component: body.component,
        level: body.level,
        problem: body.problem,
      });
      sendJson(res, entry.result === "failed" ? 422 : 200, entry);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Repair failed" });
    }
    return;
  }

  if (url.pathname === "/api/system-health/repairs" && req.method === "GET") {
    sendJson(res, 200, { repairs: systemHealthCenter.listRepairLog() });
    return;
  }

  if (url.pathname === "/api/system-health/diagnostic" && req.method === "POST") {
    sendJson(res, 201, systemHealthCenter.writeDiagnosticReport());
    return;
  }

  if (url.pathname === "/api/system-health/support-bundle" && req.method === "POST") {
    sendJson(res, 201, systemHealthCenter.createSupportBundle());
    return;
  }

  if (url.pathname === "/api/system-health/update" && req.method === "GET") {
    sendJson(res, 200, systemHealthCenter.getUpdateState());
    return;
  }

  if (url.pathname === "/api/system-health/update/check" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req) || "{}") as {
        version?: string;
        releaseId?: string;
        checksum?: string;
        packageUrl?: string;
      };
      sendJson(res, 200, systemHealthCenter.checkForUpdate(body));
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Update check failed" });
    }
    return;
  }

  if (url.pathname === "/api/system-health/update/backup" && req.method === "POST") {
    sendJson(res, 200, await systemHealthCenter.prepareUpdateBackup());
    return;
  }

  if (url.pathname === "/api/system-health/update/rollback" && req.method === "POST") {
    sendJson(res, 200, systemHealthCenter.simulateRollback());
    return;
  }

  if (url.pathname === "/api/system-health/session" && req.method === "GET") {
    sendJson(res, 200, systemHealthCenter.getInterruptedSession());
    return;
  }

  if (url.pathname === "/api/system-health/session/ack" && req.method === "POST") {
    systemHealthCenter.clearInterruptedSession();
    systemHealthCenter.markSessionRunning();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/system-health/session/clean-exit" && req.method === "POST") {
    systemHealthCenter.markCleanExit();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/system-health/certification" && req.method === "GET") {
    const certPath = path.join(process.cwd(), "release", "certification", "phase7-final-certification.json");
    if (!fs.existsSync(certPath)) {
      sendJson(res, 404, {
        ok: false,
        error: "No certification report yet. Run: npm run certify:phase7",
        verdict: "NOT READY",
      });
      return;
    }
    try {
      const payload = JSON.parse(fs.readFileSync(certPath, "utf8"));
      sendJson(res, 200, { ok: true, ...payload });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Read failed" });
    }
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

  if (url.pathname === "/api/workspace/persistence-health" && req.method === "GET") {
    const workspace = requireWorkspace(res);
    if (!workspace) return;
    try {
      sendJson(res, 200, await workspace.runPersistenceHealth());
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Persistence health check failed" });
    }
    return;
  }

  if (url.pathname === "/api/foundation-health" && req.method === "GET") {
    const workspace = requireWorkspace(res);
    if (!workspace) return;
    try {
      const { buildFoundationHealth } = await import("./foundation-health.js");
      sendJson(res, 200, await buildFoundationHealth(workspace));
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Foundation health check failed" });
    }
    return;
  }

  if (url.pathname === "/api/typography/diagnostics" && req.method === "GET") {
    try {
      const { getTypographyDiagnostics } = await import("../../ai/typography/diagnostics.js");
      sendJson(res, 200, await getTypographyDiagnostics());
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Typography diagnostics failed" });
    }
    return;
  }

  if (url.pathname === "/api/workspace/persistence-backup" && req.method === "POST") {
    const workspace = requireWorkspace(res);
    if (!workspace) return;
    try {
      const result = await workspace.createPersistenceBackup();
      sendJson(res, result.ok ? 201 : 500, result);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Persistence backup failed" });
    }
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

      const sync = await models.syncLocalInferenceProviders();

      sendJson(res, 200, { ...await models.discoverProviders(), sync });

    } catch (error) {

      sendJson(res, 503, { error: error instanceof Error ? error.message : "Unable to discover local inference providers" });

    }

    return;

  }

  if (url.pathname === "/api/models/smoke" && req.method === "POST") {

    const models = requireModelManager(res);

    if (!models) return;

    try {

      const body = JSON.parse((await readBody(req)) || "{}") as { modelId?: string };

      const smoke = await models.smokeInference(body.modelId ?? "studio-language-base");

      sendJson(res, smoke.ok ? 200 : 503, { smoke, runtime: await models.runtimeStatus() });

    } catch (error) {

      sendJson(res, 503, { error: error instanceof Error ? error.message : "Local AI smoke test failed" });

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
      const canonical = getCanonicalProductManager();
      if (canonical) await canonical.sync(imageAnalysisMatch[1]).catch(() => null);

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
      const canonical = getCanonicalProductManager();
      const product = canonical
        ? await canonical.correctView(imageOverrideMatch[1], imageOverrideMatch[2], body.viewRole).catch(() => null)
        : null;

      sendJson(res, 200, { profile, dashboard: await intelligence.getDashboard(imageOverrideMatch[1]), product });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to override view role" });

    }

    return;

  }

  const mediaIntelligenceMatch = url.pathname.match(/^\/api\/media-intelligence\/projects\/([^/]+)$/);

  if (mediaIntelligenceMatch && req.method === "GET") {

    const media = requireMediaIntelligence(res);

    if (!media) return;

    try {

      const report = await media.getReport(mediaIntelligenceMatch[1]);

      sendJson(res, 200, { report });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Media intelligence report failed" });

    }

    return;

  }

  const mediaPrepareMatch = url.pathname.match(/^\/api\/media-intelligence\/projects\/([^/]+)\/prepare$/);

  if (mediaPrepareMatch && req.method === "POST") {

    const media = requireMediaIntelligence(res);

    if (!media) return;

    try {

      const report = await media.prepareProject(mediaPrepareMatch[1]);

      sendJson(res, 201, { report });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Media intelligence preparation failed" });

    }

    return;

  }

  if (url.pathname === "/api/media-intelligence/ollama-readiness" && req.method === "GET") {

    try {

      const { assessOllamaReadiness, toPublicOllamaReadiness } = await import("../../ai/media-intelligence/ollama-readiness.js");

      sendJson(res, 200, { readiness: toPublicOllamaReadiness(await assessOllamaReadiness()) });

    } catch (error) {

      sendJson(res, 500, { error: error instanceof Error ? error.message : "Ollama readiness check failed" });

    }

    return;

  }

  if (url.pathname === "/api/creative-director/status" && req.method === "GET") {
    try {
      const { getAiDirectorStatusSummary } = await import("../../ai/ai-director/ai-director-service.js");
      const summary = await getAiDirectorStatusSummary();
      sendJson(res, 200, { status: summary });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Creative director status failed" });
    }
    return;
  }

  if (url.pathname === "/api/ai-director/diagnostics" && req.method === "GET") {
    try {
      const { getAiDirectorDiagnostics } = await import("../../ai/ai-director/ai-director-service.js");
      const diagnostics = await getAiDirectorDiagnostics();
      sendJson(res, 200, { diagnostics });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "AI director diagnostics failed" });
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

  const productRenderingPreviewMatch = url.pathname.match(/^\/api\/product-rendering-export\/projects\/([^/]+)\/preview$/);

  if (productRenderingPreviewMatch && req.method === "GET") {

    const rendering = requireProductRenderingExport(res);

    if (!rendering) return;

    try {

      const dashboard = await rendering.getDashboard(productRenderingPreviewMatch[1]);

      const latest = dashboard.renders[0];

      if (!latest?.artifacts?.previewRelativePath) {

        sendJson(res, 404, { error: "No rendered preview available yet" });

        return;

      }

      const previewPath = await rendering.getArtifactAbsolutePath(latest.artifacts.previewRelativePath);

      if (!previewPath) { sendJson(res, 404, { error: "Preview artifact missing on disk" }); return; }

      await serveStatic(res, previewPath);

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to serve preview" });

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
      const canonical = getCanonicalProductManager();
      const product = canonical ? await canonical.sync(productAnalysisMatch[1]).catch(() => null) : null;

      sendJson(res, 201, { profile, analysisState: intelligence.getAnalysisState(productAnalysisMatch[1]), dashboard: await intelligence.getDashboard(productAnalysisMatch[1]), product });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Product analysis failed" });

    }

    return;

  }

  const productProfileMatch = url.pathname.match(/^\/api\/product-intelligence\/projects\/([^/]+)$/);

  if (productProfileMatch && req.method === "GET") {

    const intelligence = requireProductIntelligence(res);

    if (!intelligence) return;

    sendJson(res, 200, {
      profile: await intelligence.getProfile(productProfileMatch[1]),
      analysisState: intelligence.getAnalysisState(productProfileMatch[1]),
    });

    return;

  }

  const productRecordMatch = url.pathname.match(/^\/api\/product-record\/projects\/([^/]+)$/);
  if (productRecordMatch && req.method === "GET") {
    const canonical = requireCanonicalProduct(res);
    if (!canonical) return;
    const product = await canonical.get(productRecordMatch[1]) ?? await canonical.sync(productRecordMatch[1]).catch(() => null);
    if (!product) { sendJson(res, 404, { error: "Product record not found" }); return; }
    sendJson(res, 200, { product });
    return;
  }
  if (productRecordMatch && req.method === "POST") {
    const canonical = requireCanonicalProduct(res);
    if (!canonical) return;
    try {
      const product = await canonical.sync(productRecordMatch[1]);
      sendJson(res, 200, { product });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to sync product record" });
    }
    return;
  }

  const productRecordViewMatch = url.pathname.match(/^\/api\/product-record\/projects\/([^/]+)\/assets\/([^/]+)\/view$/);
  if (productRecordViewMatch && req.method === "POST") {
    const canonical = requireCanonicalProduct(res);
    if (!canonical) return;
    try {
      const body = JSON.parse(await readBody(req)) as { view?: string };
      if (!body.view) { sendJson(res, 400, { error: "view is required" }); return; }
      const product = await canonical.correctView(productRecordViewMatch[1], productRecordViewMatch[2], body.view);
      sendJson(res, 200, { product, assetMap: product.assetMap, intelligence: product.intelligence });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to correct view" });
    }
    return;
  }

  const productRecordMapMatch = url.pathname.match(/^\/api\/product-record\/projects\/([^/]+)\/asset-map$/);
  if (productRecordMapMatch && req.method === "GET") {
    const canonical = requireCanonicalProduct(res);
    if (!canonical) return;
    const product = await canonical.get(productRecordMapMatch[1]) ?? await canonical.sync(productRecordMapMatch[1]).catch(() => null);
    if (!product) { sendJson(res, 404, { error: "Product record not found" }); return; }
    sendJson(res, 200, {
      productId: product.productId,
      assetMap: product.assetMap,
      productViews: product.productViews,
      intelligence: product.intelligence,
      readiness: product.productionData,
    });
    return;
  }

  const marketingBriefMatch = url.pathname.match(/^\/api\/marketing-brief\/projects\/([^/]+)$/);
  if (marketingBriefMatch && req.method === "GET") {
    const briefs = requireMarketingBrief(res);
    if (!briefs) return;
    const canonical = getCanonicalProductManager();
    try {
      const brief = await briefs.get(marketingBriefMatch[1]) ?? await briefs.getOrCreate(marketingBriefMatch[1]);
      const product = await canonical?.get(marketingBriefMatch[1]) ?? null;
      sendJson(res, 200, { brief, product });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to load marketing brief" });
    }
    return;
  }
  if (marketingBriefMatch && req.method === "PUT") {
    const briefs = requireMarketingBrief(res);
    if (!briefs) return;
    try {
      const body = JSON.parse(await readBody(req)) as {
        campaign?: Record<string, unknown>;
        output?: Record<string, unknown>;
        userDefined?: Record<string, unknown>;
        lockFields?: string[];
      };
      const brief = await briefs.updateSettings(marketingBriefMatch[1], {
        campaign: body.campaign as Parameters<typeof briefs.updateSettings>[1]["campaign"],
        output: body.output as Parameters<typeof briefs.updateSettings>[1]["output"],
        userDefined: body.userDefined,
        lockFields: body.lockFields,
      });
      sendJson(res, 200, { brief });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to update marketing brief" });
    }
    return;
  }

  const marketingBriefAnalyzeMatch = url.pathname.match(/^\/api\/marketing-brief\/projects\/([^/]+)\/analyze$/);
  if (marketingBriefAnalyzeMatch && req.method === "POST") {
    const briefs = requireMarketingBrief(res);
    if (!briefs) return;
    try {
      const brief = await briefs.analyze(marketingBriefAnalyzeMatch[1]);
      const canonical = getCanonicalProductManager();
      const product = await canonical?.get(marketingBriefAnalyzeMatch[1]) ?? null;
      sendJson(res, 200, { brief, product, intelligence: brief.intelligence });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Marketing intelligence failed" });
    }
    return;
  }

  const marketingBriefFinalizeMatch = url.pathname.match(/^\/api\/marketing-brief\/projects\/([^/]+)\/finalize$/);
  if (marketingBriefFinalizeMatch && req.method === "POST") {
    const briefs = requireMarketingBrief(res);
    if (!briefs) return;
    try {
      const brief = await briefs.finalize(marketingBriefFinalizeMatch[1]);
      sendJson(res, 200, { brief });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to finalize marketing brief" });
    }
    return;
  }

  const marketingBriefRecMatch = url.pathname.match(
    /^\/api\/marketing-brief\/projects\/([^/]+)\/recommendations\/([^/]+)\/(accept|reject|edit)$/,
  );
  if (marketingBriefRecMatch && req.method === "POST") {
    const briefs = requireMarketingBrief(res);
    if (!briefs) return;
    try {
      const [, projectId, recId, action] = marketingBriefRecMatch;
      let brief;
      if (action === "accept") brief = await briefs.acceptRecommendation(projectId, recId);
      else if (action === "reject") brief = await briefs.rejectRecommendation(projectId, recId);
      else {
        const body = JSON.parse(await readBody(req)) as { value?: string | string[] };
        if (body.value == null) { sendJson(res, 400, { error: "value is required" }); return; }
        brief = await briefs.editRecommendation(projectId, recId, body.value);
      }
      sendJson(res, 200, { brief });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to update recommendation" });
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

  const marketingProfileMatch = url.pathname.match(/^\/api\/marketing-intelligence\/projects\/([^/]+)$/);

  if (marketingProfileMatch && req.method === "GET") {

    const intelligence = requireMarketingIntelligence(res);

    if (!intelligence) return;

    sendJson(res, 200, { profile: await intelligence.getProfile(marketingProfileMatch[1]) });

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

      const body = JSON.parse(await readBody(req)) as {
        action?: string;
        changes?: Record<string, unknown>;
        productionMode?: import("../../ai/video-production/production-mode-types.js").ProductionModeId;
        creativeTone?: import("../../ai/video-production/production-mode-types.js").CreativeToneId;
        regenerate?: boolean;
        durationSeconds?: number;
      };

      if (body.action === "generate") {

        const project = await workspace.getProject(planMatch[1]);

        if (!project) { sendJson(res, 404, { error: "Project not found" }); return; }

        const result = await planning.createPlan(project, planning.validateForPlan(project), {
          productionMode: body.productionMode,
          creativeTone: body.creativeTone,
          regenerate: body.regenerate,
          durationSeconds: body.durationSeconds,
        });

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

  const productionManifestMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/production-manifest$/);

  if (productionManifestMatch && req.method === "GET") {

    const planning = requirePlanning(res);

    if (!planning) return;

    sendJson(res, 200, { manifest: await planning.getManifest(productionManifestMatch[1]) });

    return;

  }

  const planFinalizeMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/plan\/finalize$/);

  if (planFinalizeMatch && req.method === "POST") {

    const planning = requirePlanning(res);

    if (!planning) return;

    try {

      const result = await planning.finalize(planFinalizeMatch[1]);

      sendJson(res, 200, result);

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to finalize production plan" });

    }

    return;

  }

  const videoCapabilitiesMatch = url.pathname === "/api/video-production/capabilities";
  if (videoCapabilitiesMatch && req.method === "GET") {
    try {
      const { getProductionCapabilities } = await import("../../ai/video-production/production-capabilities.js");
      const uniqueViewCount = Number(url.searchParams.get("views") ?? "0") || 0;
      sendJson(res, 200, { capabilities: await getProductionCapabilities({ uniqueViewCount }) });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Unable to read production capabilities" });
    }
    return;
  }

  const videoProjectMatch = url.pathname.match(/^\/api\/video-production\/projects\/([^/]+)$/);
  if (videoProjectMatch && req.method === "GET") {
    const production = requireVideoProduction(res);
    if (!production) return;
    try {
      const video = await production.getVideoProject(videoProjectMatch[1]);
      sendJson(res, 200, { video });
    } catch (error) {
      sendVideoProductionError(res, error);
    }
    return;
  }

  if (videoProjectMatch && req.method === "POST") {
    const production = requireVideoProduction(res);
    if (!production) return;
    try {
      const body = JSON.parse(await readBody(req)) as {
        action?: string;
        aspectRatio?: "16:9" | "9:16" | "1:1";
        platform?: import("../../ai/video-production/types.js").VideoPlatformId;
        reorder?: string[];
        clip?: {
          id: string;
          durationMs?: number;
          camera?: import("../../ai/video-production/types.js").VideoCameraId;
          motion?: import("../../ai/video-production/types.js").VideoMotionId;
          transitionOut?: import("../../ai/video-production/types.js").VideoTransitionId;
          assetId?: string;
          text?: string;
        };
      };
      if (body.action === "update") {
        const video = await production.updateVideoProject(videoProjectMatch[1], {
          aspectRatio: body.aspectRatio,
          platform: body.platform,
          reorder: body.reorder,
          clip: body.clip,
        });
        sendJson(res, 200, { video });
      } else {
        const video = await production.createOrRefresh(videoProjectMatch[1]);
        sendJson(res, 201, { video });
      }
    } catch (error) {
      sendVideoProductionError(res, error);
    }
    return;
  }

  const videoValidateMatch = url.pathname.match(/^\/api\/video-production\/projects\/([^/]+)\/validate$/);
  if (videoValidateMatch && req.method === "GET") {
    const production = requireVideoProduction(res);
    if (!production) return;
    try {
      const preset = url.searchParams.get("preset") === "preview" ? "preview" : "standard";
      const validation = await production.validateRender(videoValidateMatch[1], preset);
      sendJson(res, 200, { validation });
    } catch (error) {
      sendVideoProductionError(res, error);
    }
    return;
  }

  const videoOutputMatch = url.pathname.match(/^\/api\/video-production\/projects\/([^/]+)\/output$/);
  if (videoOutputMatch && req.method === "GET") {
    const production = requireVideoProduction(res);
    if (!production) return;
    try {
      const details = await production.getOutputDetails(videoOutputMatch[1]);
      if (!details) { sendJson(res, 404, { error: "No video output registered for this project" }); return; }
      sendJson(res, 200, { output: details });
    } catch (error) {
      sendVideoProductionError(res, error);
    }
    return;
  }

  const videoVersionsMatch = url.pathname.match(/^\/api\/video-production\/projects\/([^/]+)\/versions$/);
  if (videoVersionsMatch && req.method === "GET") {
    const production = requireVideoProduction(res);
    if (!production) return;
    try {
      const versions = await production.getVersions(videoVersionsMatch[1]);
      sendJson(res, 200, { versions });
    } catch (error) {
      sendVideoProductionError(res, error);
    }
    return;
  }

  const videoRenderMatch = url.pathname.match(/^\/api\/video-production\/projects\/([^/]+)\/render$/);
  if (videoRenderMatch && req.method === "POST") {
    const production = requireVideoProduction(res);
    if (!production) return;
    try {
      const body = JSON.parse(await readBody(req) || "{}") as { preset?: "preview" | "standard" };
      const result = await production.startRender(videoRenderMatch[1], body.preset === "standard" ? "standard" : "preview");
      sendJson(res, 202, result);
    } catch (error) {
      sendVideoProductionError(res, error);
    }
    return;
  }

  const videoJobMatch = url.pathname.match(/^\/api\/video-production\/jobs\/([^/]+)$/);
  if (videoJobMatch && req.method === "GET") {
    const production = requireVideoProduction(res);
    if (!production) return;
    const job = await production.getJob(videoJobMatch[1]);
    if (!job) { sendJson(res, 404, { error: "Render job not found" }); return; }
    sendJson(res, 200, { job });
    return;
  }

  const videoProjectJobMatch = url.pathname.match(/^\/api\/video-production\/projects\/([^/]+)\/jobs\/([^/]+)$/);
  if (videoProjectJobMatch && req.method === "GET") {
    const production = requireVideoProduction(res);
    if (!production) return;
    const job = await production.getJob(videoProjectJobMatch[2], videoProjectJobMatch[1]);
    if (!job) { sendJson(res, 404, { error: "Render job not found" }); return; }
    sendJson(res, 200, { job });
    return;
  }

  if (url.pathname === "/api/workspace/projects" && req.method === "POST") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    try {

      const body = JSON.parse(await readBody(req)) as { name?: string };

      const created = await workspace.createProject(body.name ?? "");
      const project = await withFoundation(workspace, created, "create");
      sendJson(res, 201, { project, validation: workspace.validate(project) });

    } catch (error) {

      sendWorkspaceError(res, error);

    }

    return;

  }

  const projectMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)$/);

  if (projectMatch && req.method === "GET") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    const project = await workspace.getProject(projectMatch[1]);

    if (!project) { sendJson(res, 404, { error: "Project not found" }); return; }

    sendJson(res, 200, {
      project,
      assets: workspace.listProjectAssets(project),
      validation: workspace.validate(project),
      intake: workspace.validateIntake(project),
      productProfile: workspace.validateProductProfile(project),
      marketingBrief: workspace.validateMarketingBrief(project),
      productionReadiness: workspace.validateProductionReadiness(project),
    });

    return;

  }

  if (projectMatch && req.method === "POST") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    try {

      const body = JSON.parse(await readBody(req)) as { action?: string; changes?: Record<string, unknown> };

      let project = body.action === "open"
        ? await workspace.openProject(projectMatch[1])
        : body.action === "close"
          ? await workspace.closeProject(projectMatch[1])
          : await workspace.updateProject(projectMatch[1], body.changes ?? {});

      if (!project) { sendJson(res, 404, { error: "Project not found", code: "PROJECT_NOT_FOUND" }); return; }

      if (body.action === "open") {
        project = await withFoundation(workspace, project, "open");
      }

      sendJson(res, 200, {
        project,
        assets: workspace.listProjectAssets(project),
        validation: workspace.validate(project),
        intake: workspace.validateIntake(project),
        productProfile: workspace.validateProductProfile(project),
        marketingBrief: workspace.validateMarketingBrief(project),
        productionReadiness: workspace.validateProductionReadiness(project),
      });

    } catch (error) {

      sendWorkspaceError(res, error);

    }

    return;

  }

  const productionDefaultsMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/production-defaults$/);

  if (productionDefaultsMatch && req.method === "POST") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    try {

      const project = await workspace.ensureProductProductionDefaults(productionDefaultsMatch[1]);

      sendJson(res, 200, { project, productProfile: workspace.validateProductProfile(project) });

    } catch (error) {

      sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to apply production defaults" });

    }

    return;

  }

  const productionJobMatch = url.pathname.match(/^\/api\/production\/projects\/([^/]+)\/job$/);

  if (productionJobMatch) {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    const projectId = productionJobMatch[1];

    if (req.method === "GET") {

      const job = await workspace.getProductionJob(projectId);

      sendJson(res, 200, { job });

      return;

    }

    if (req.method === "POST") {

      try {

        const body = JSON.parse(await readBody(req)) as Record<string, unknown>;

        const project = await workspace.saveProductionJob(projectId, body);

        sendJson(res, 200, { job: body, project });

      } catch (error) {

        sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to save production job" });

      }

      return;

    }

  }

  const productionOutputMatch = url.pathname.match(/^\/api\/production\/projects\/([^/]+)\/output-validation$/);

  if (productionOutputMatch && req.method === "GET") {

    const rendering = requireProductRenderingExport(res);

    if (!rendering) return;

    try {

      const projectId = productionOutputMatch[1];

      const delivery = await rendering.getRender(projectId);

      if (!delivery) {

        sendJson(res, 200, { valid: false, outputUrl: null, version: null, quality: null, durationSec: null, format: null, fileSizeBytes: null, issues: ["No render output found"] });

        return;

      }

      const finalPath = await rendering.getArtifactAbsolutePath(delivery.artifacts.finalVideoRelativePath);

      const previewPath = await rendering.getArtifactAbsolutePath(delivery.artifacts.previewRelativePath);

      const issues: string[] = [];

      if (!finalPath) issues.push("Final output file missing");

      if (!previewPath) issues.push("Preview artifact missing");

      let fileSizeBytes: number | null = null;

      if (finalPath) {

        const stat = await (await import("node:fs/promises")).stat(finalPath);

        fileSizeBytes = stat.size;

        if (stat.size < 50) issues.push("Output file empty or too small");

        const content = await (await import("node:fs/promises")).readFile(finalPath, "utf8");

        if (!content.includes("<svg") && !content.includes("<?xml")) issues.push("Invalid output format");

      }

      if (delivery.quality.overall < 30) issues.push(`Quality score ${delivery.quality.overall}/100 below minimum`);

      const valid = issues.length === 0;

      sendJson(res, 200, {

        valid,

        outputUrl: valid ? `/api/product-rendering-export/projects/${encodeURIComponent(projectId)}/preview` : null,

        version: String(delivery.version),

        quality: delivery.quality.overall,

        durationSec: null,

        format: delivery.settings.format,

        fileSizeBytes,

        issues,

      });

    } catch (error) {

      sendJson(res, 500, { valid: false, outputUrl: null, version: null, quality: null, durationSec: null, format: null, fileSizeBytes: null, issues: [error instanceof Error ? error.message : "Validation failed"] });

    }

    return;

  }

  const productionArtifactsMatch = url.pathname.match(/^\/api\/production\/projects\/([^/]+)\/artifacts$/);

  if (productionArtifactsMatch && req.method === "GET") {

    const scenePlanning = requireProductScenePlanning(res);

    const storyboard = requireProductStoryboard(res);

    const projectId = productionArtifactsMatch[1];

    try {

      const scenePlan = scenePlanning ? (await scenePlanning.getDashboard(projectId)).plans.at(-1) : undefined;

      const story = storyboard ? (await storyboard.getDashboard(projectId)).storyboards.at(-1) : undefined;

      sendJson(res, 200, {

        scenePlan: scenePlan ? { sceneCount: scenePlan.sceneCount, flowScore: scenePlan.quality.marketingFlowScore } : undefined,

        storyboard: story ? { sceneCount: story.totalScenes, scriptScore: story.quality.scriptScore } : undefined,

      });

    } catch (error) {

      sendJson(res, 200, { scenePlan: undefined, storyboard: undefined, error: error instanceof Error ? error.message : "Artifacts unavailable" });

    }

    return;

  }

  const imageMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/images\/([^/]+)$/);

  if (imageMatch && (req.method === "GET" || req.method === "HEAD")) {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    const imagePath = await workspace.getImagePath(imageMatch[1], imageMatch[2]);

    if (!imagePath) { sendJson(res, 404, { error: "Product image not found" }); return; }

    await serveStatic(res, imagePath, req.method);

    return;

  }

  const videoFileMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/videos\/([^/]+)$/);
  if (videoFileMatch && (req.method === "GET" || req.method === "HEAD")) {
    const workspace = requireWorkspace(res);
    if (!workspace) return;
    const videoPath = await workspace.getVideoPath(videoFileMatch[1], videoFileMatch[2]);
    if (!videoPath) { sendJson(res, 404, { error: "Video not found" }); return; }
    await serveStatic(res, videoPath, req.method);
    return;
  }

  const uploadMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/images$/);

  if (uploadMatch && req.method === "POST") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    try {

      const body = JSON.parse(await readBody(req)) as { fileName?: string; mimeType?: string; dataBase64?: string; width?: number; height?: number; checksumSha256?: string };
      const image = await workspace.uploadImage(uploadMatch[1], {
        fileName: body.fileName ?? "product-image",
        mimeType: body.mimeType ?? "",
        dataBase64: body.dataBase64 ?? "",
        width: typeof body.width === "number" ? body.width : undefined,
        height: typeof body.height === "number" ? body.height : undefined,
        checksumSha256: typeof body.checksumSha256 === "string" ? body.checksumSha256 : undefined,
      });
      const reused = Boolean((image as { reused?: boolean }).reused);
      // Respond as soon as the original is persisted. Foundation sync + ingest must not
      // delay or fail the upload response (transient foundation errors were hiding success).
      const intelligence = getImageIntelligenceManager();
      const media = getMediaIntelligenceManager();
      const ingestQueued = Boolean(intelligence?.isInitialized()) && !reused;
      const raw = await workspace.getProject(uploadMatch[1]);
      sendJson(res, reused ? 200 : 201, {
        image,
        project: raw,
        asset: raw ? workspace.getAsset(raw, image.id) : null,
        validation: workspace.validate(raw),
        intake: workspace.validateIntake(raw),
        ingestQueued,
        reused,
        product: null,
      });

      if (!reused) {
        setImmediate(() => {
          void (async () => {
            try {
              if (intelligence?.isInitialized()) {
                await ingestUploadedImage(workspace, intelligence, uploadMatch[1], image.id);
                await media?.processAsset(uploadMatch[1], image.id).catch(() => undefined);
              }
              const canonical = getCanonicalProductManager();
              await canonical?.sync(uploadMatch[1]).catch(() => null);
              const latest = await workspace.getProject(uploadMatch[1]);
              if (latest) await withFoundation(workspace, latest, "asset");
            } catch {
              /* background post-upload work must never undo a successful store */
            }
          })();
        });
      }
    } catch (error) {

      sendWorkspaceError(res, error);

    }

    return;

  }

  const removeImageMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/images\/([^/]+)$/);

  if (removeImageMatch && req.method === "DELETE") {

    const workspace = requireWorkspace(res);

    if (!workspace) return;

    try {

      const project = await workspace.removeImage(removeImageMatch[1], removeImageMatch[2]);
      const canonical = getCanonicalProductManager();
      if (canonical) await canonical.sync(removeImageMatch[1]).catch(() => null);

      sendJson(res, 200, { project, validation: workspace.validate(project), intake: workspace.validateIntake(project) });

    } catch (error) {

      sendWorkspaceError(res, error);

    }

    return;

  }

  const assetsMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/assets$/);

  if (assetsMatch && req.method === "GET") {
    const workspace = requireWorkspace(res);
    if (!workspace) return;
    const project = await workspace.getProject(assetsMatch[1]);
    if (!project) { sendJson(res, 404, { error: "Project not found", code: "PROJECT_NOT_FOUND" }); return; }
    sendJson(res, 200, {
      projectId: project.id,
      assets: workspace.listProjectAssets(project),
    });
    return;
  }

  if (assetsMatch && req.method === "POST") {
    const workspace = requireWorkspace(res);
    if (!workspace) return;
    try {
      const body = JSON.parse(await readBody(req)) as {
        fileName?: string;
        mimeType?: string;
        dataBase64?: string;
        parentAssetId?: string;
        assetType?: "derived-image" | "generated-image";
      };
      if (!body.parentAssetId) {
        sendJson(res, 400, { error: "parentAssetId is required for derived assets", code: "INVALID_ASSET" });
        return;
      }
      const derived = await workspace.registerDerivedAsset(assetsMatch[1], {
        fileName: body.fileName ?? "derived.png",
        mimeType: body.mimeType ?? "image/png",
        dataBase64: body.dataBase64 ?? "",
        parentAssetId: body.parentAssetId,
        assetType: body.assetType ?? "derived-image",
      });
      const raw = await workspace.getProject(assetsMatch[1]);
      const project = raw ? await withFoundation(workspace, raw, "asset") : raw;
      sendJson(res, 201, {
        image: derived,
        asset: project ? workspace.getAsset(project, derived.id) : null,
        project,
      });
    } catch (error) {
      sendWorkspaceError(res, error);
    }
    return;
  }

  const assetMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/assets\/([^/]+)$/);

  if (assetMatch && req.method === "GET") {
    const workspace = requireWorkspace(res);
    if (!workspace) return;
    const project = await workspace.getProject(assetMatch[1]);
    if (!project) { sendJson(res, 404, { error: "Project not found", code: "PROJECT_NOT_FOUND" }); return; }
    const asset = workspace.getAsset(project, assetMatch[2]);
    if (!asset) { sendJson(res, 404, { error: "Asset not found", code: "ASSET_NOT_FOUND" }); return; }
    sendJson(res, 200, { asset });
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



const server = createServer((req, res) => {

  const url = new URL(req.url ?? "/", `http://${HOST}:${activePort}`);

  if (url.pathname === "/api/health") {
    const health = coreHttpHealth(getRuntimeStatus());
    sendJson(res, 200, {
      ok: health.status !== "unhealthy",
      status: health.status,
      name: "KWIZERA AI STUDIO",
      mode: isProductionEnv()
        ? "production"
        : isPersistentMode()
          ? "persistent-local-development"
          : "local-development",
      host: HOST,
      port: activePort,
      storageRoot,
      persistent: isPersistentMode(),
      runtimeReady: health.runtimeReady,
      sessionRestored: health.sessionRestored,
      message: health.message,
      architecture: "kwizera-ai-core",
    });
    return;
  }

  void handleIncomingRequest(req, res, url);

});

async function handleIncomingRequest(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    const resolved = resolvePublicUiFile(url.pathname, UI_DIR);
    if (resolved.kind === "missing-studio") {
      sendJson(res, 503, {
        error: "Studio UI is not built. Run npm run build:production so dev/ui/desktop/index.html exists.",
        expected: path.join(UI_DIR, "desktop", "index.html"),
      });
      return;
    }
    if (resolved.kind === "not-found") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    await serveStatic(res, resolved.filePath);
  } catch (error) {
    console.error("[KWIZERA] Request handler error:", error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Request failed" });
    }
  }
}



function openBrowser(address: string): void {

  if (process.env.KWIZERA_SKIP_BROWSER_OPEN === "1" || isProductionEnv()) return;

  if (process.platform === "win32") {

    spawn("cmd", ["/c", "start", "chrome", address], { detached: true, stdio: "ignore" }).unref();

  }

}



function printStartupBanner(port: number, restored: boolean): void {

  const address = `http://${resolveHealthProbeHost(HOST)}:${port}`;

  console.log("");

  console.log(isProductionEnv()
    ? "  KWIZERA AI STUDIO — Production"
    : "  KWIZERA AI STUDIO — Persistent Local Development");

  console.log(`  Dashboard: ${address}`);

  console.log(`  Bind:      ${HOST}:${port}`);

  console.log(`  Storage:   ${storageRoot}`);

  console.log(`  Session:   ${restored ? "restored from previous run" : "initialized"}`);

  console.log(isProductionEnv()
    ? "  KWIZERA AI Core remains the foundation — external providers are optional"
    : "  Offline only — not deployed");

  console.log("");

  openBrowser(address);

}



function startListening(port: number): void {

  server.once("error", (err: NodeJS.ErrnoException) => {

    if (err.code === "EADDRINUSE") {

      console.error(`[KWIZERA] Port ${port} is already in use.`);

      console.error(`  Stop the other process, or set KWIZERA_PORT to a free port and retry.`);

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

  // Let the HTTP server accept health probes before CPU-heavy AI Core init.
  const bootDelayMs = Number(process.env.KWIZERA_BOOT_DELAY_MS ?? 750);

  setTimeout(() => {
    void (async () => {
      try {
        await persistentMemoryCenter.boot(storageRoot);
      } catch (err) {
        console.error("[KWIZERA] Persistent Memory Center boot error:", err);
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
      void onlineKnowledgeEngine.boot(storageRoot).catch((err) => {
        console.error("[KWIZERA] Online Knowledge Engine boot error:", err);
      });
      void systemHealthCenter.boot(storageRoot).then(() => {
        systemHealthCenter.markSessionRunning();
      }).catch((err) => {
        console.error("[KWIZERA] System Health Center boot error:", err);
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      try {
        const runtime = await bootPersistentRuntime(HOST, PORT);
        console.log(`[KWIZERA] ${runtime.message}`);
        void saveRuntimeSnapshot();
      } catch (err) {
        console.error("[KWIZERA] Background runtime boot error:", err);
      }
    })();
  }, bootDelayMs);

}



main().catch((err) => {

  console.error("[KWIZERA] Fatal startup error:", err);

  process.exit(1);

});



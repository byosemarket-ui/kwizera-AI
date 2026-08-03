import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveStorageRoot } from "../../storage/paths/storage-paths.js";
import { bootPersistentRuntime, getPersistentRuntime, getImageGenerationManager, getVideoAudioGenerationManager, getGenerationOptimizationManager, getProductIntelligenceManager, getImageIntelligenceManager, getMarketingIntelligenceManager, getDecisionIntelligenceManager, getLearningIntelligenceManager, getModelManager, getPlanningManager, getPipelineManager, getReviewManager, getRuntimeStatus, getSessionStore, getWorkspaceManager, isPersistentMode, registerShutdownHandlers, saveRuntimeSnapshot, } from "../persistent/runtime.js";
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
function sendJson(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json",
    });
    res.end(JSON.stringify(data));
}
async function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let rejected = false;
        const contentLength = Number(req.headers["content-length"] ?? 0);
        if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
            reject(new Error("Request body exceeds the 24 MB limit"));
            req.resume();
            return;
        }
        req.on("data", (chunk) => {
            if (rejected)
                return;
            size += chunk.length;
            if (size > MAX_REQUEST_BODY_BYTES) {
                rejected = true;
                reject(new Error("Request body exceeds the 24 MB limit"));
                req.resume();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => { if (!rejected)
            resolve(Buffer.concat(chunks).toString("utf8")); });
        req.on("error", reject);
    });
}
function contentType(filePath) {
    if (filePath.endsWith(".html"))
        return "text/html; charset=utf-8";
    if (filePath.endsWith(".css"))
        return "text/css; charset=utf-8";
    if (filePath.endsWith(".js"))
        return "application/javascript; charset=utf-8";
    if (filePath.endsWith(".png"))
        return "image/png";
    if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg"))
        return "image/jpeg";
    if (filePath.endsWith(".webp"))
        return "image/webp";
    if (filePath.endsWith(".svg"))
        return "image/svg+xml";
    if (filePath.endsWith(".mp4"))
        return "video/mp4";
    if (filePath.endsWith(".mov"))
        return "video/quicktime";
    if (filePath.endsWith(".webm"))
        return "video/webm";
    if (filePath.endsWith(".mp3"))
        return "audio/mpeg";
    if (filePath.endsWith(".wav"))
        return "audio/wav";
    return "application/octet-stream";
}
async function serveStatic(res, filePath) {
    try {
        const data = await fs.promises.readFile(filePath);
        res.writeHead(200, { "Content-Type": contentType(filePath) });
        res.end(data);
    }
    catch (error) {
        if (error.code === "ENOENT") {
            res.writeHead(404);
            res.end("Not found");
            return;
        }
        res.writeHead(500);
        res.end("Unable to read file");
    }
}
function resolveUiAsset(pathname) {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(pathname);
    }
    catch {
        return null;
    }
    const filePath = path.resolve(UI_DIR, `.${decodedPath}`);
    return filePath === UI_DIR || filePath.startsWith(`${UI_DIR}${path.sep}`) ? filePath : null;
}
function requireWorkspace(res) {
    const workspace = getWorkspaceManager();
    if (!workspace) {
        sendJson(res, 503, { error: "Creative workspace is restoring. Try again shortly." });
        return null;
    }
    return workspace;
}
function requirePlanning(res) {
    const planning = getPlanningManager();
    if (!planning) {
        sendJson(res, 503, { error: "Creative planning is restoring. Try again shortly." });
        return null;
    }
    return planning;
}
function requireReview(res) {
    const review = getReviewManager();
    if (!review) {
        sendJson(res, 503, { error: "Creative review is restoring. Try again shortly." });
        return null;
    }
    return review;
}
function requirePipeline(res) {
    const pipeline = getPipelineManager();
    if (!pipeline) {
        sendJson(res, 503, { error: "Creative pipeline is restoring. Try again shortly." });
        return null;
    }
    return pipeline;
}
function requireModelManager(res) {
    const models = getModelManager();
    if (!models) {
        sendJson(res, 503, { error: "AI Model Management is restoring. Try again shortly." });
        return null;
    }
    return models;
}
function requireImageGeneration(res) {
    const images = getImageGenerationManager();
    if (!images) {
        sendJson(res, 503, { error: "Image generation is restoring. Try again shortly." });
        return null;
    }
    return images;
}
function requireVideoAudioGeneration(res) {
    const videoAudio = getVideoAudioGenerationManager();
    if (!videoAudio) {
        sendJson(res, 503, { error: "Video and audio generation is restoring. Try again shortly." });
        return null;
    }
    return videoAudio;
}
function requireGenerationOptimization(res) {
    const optimization = getGenerationOptimizationManager();
    if (!optimization) {
        sendJson(res, 503, { error: "Generation optimization is restoring. Try again shortly." });
        return null;
    }
    return optimization;
}
function requireProductIntelligence(res) {
    const intelligence = getProductIntelligenceManager();
    if (!intelligence) {
        sendJson(res, 503, { error: "Product intelligence is restoring. Try again shortly." });
        return null;
    }
    return intelligence;
}
function requireImageIntelligence(res) {
    const intelligence = getImageIntelligenceManager();
    if (!intelligence) {
        sendJson(res, 503, { error: "Image intelligence is restoring. Try again shortly." });
        return null;
    }
    return intelligence;
}
function requireMarketingIntelligence(res) {
    const intelligence = getMarketingIntelligenceManager();
    if (!intelligence) {
        sendJson(res, 503, { error: "Marketing intelligence is restoring. Try again shortly." });
        return null;
    }
    return intelligence;
}
function requireDecisionIntelligence(res) {
    const intelligence = getDecisionIntelligenceManager();
    if (!intelligence) {
        sendJson(res, 503, { error: "Decision intelligence is restoring. Try again shortly." });
        return null;
    }
    return intelligence;
}
function requireLearningIntelligence(res) {
    const learning = getLearningIntelligenceManager();
    if (!learning) {
        sendJson(res, 503, { error: "AI learning intelligence is restoring. Try again shortly." });
        return null;
    }
    return learning;
}
function createIsolatedStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-"));
}
function cleanupTemp(dir) {
    try {
        if (fs.existsSync(dir))
            fs.rmSync(dir, { recursive: true, force: true });
    }
    catch { /* ignore */ }
}
function pathToFileUrl(filePath) {
    return `file:///${path.resolve(filePath).replace(/\\/g, "/")}`;
}
async function runSmokeTest(aiPath) {
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, durationMs: Date.now() - start, message, output: message };
    }
}
async function runValidationScript(validateKey) {
    const start = Date.now();
    const isolatedRoot = createIsolatedStorageRoot();
    return new Promise((resolve) => {
        const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", `validate:${validateKey}`], { cwd: projectRoot, env: { ...process.env, KWIZERA_STORAGE_ROOT: isolatedRoot }, shell: true });
        let output = "";
        child.stdout.on("data", (d) => { output += d.toString(); });
        child.stderr.on("data", (d) => { output += d.toString(); });
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
async function runEngineQuickTest(engineName) {
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
    }
    catch (err) {
        cleanupTemp(isolatedRoot);
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, durationMs: Date.now() - start, message, output: message };
    }
}
async function handleApi(req, res, url) {
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
            activeProject: (await getWorkspaceManager()?.getActiveProject())?.name ?? "No active project",
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
    if (url.pathname === "/api/workspace") {
        const workspace = requireWorkspace(res);
        if (!workspace)
            return;
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
        if (!pipeline)
            return;
        sendJson(res, 200, pipeline.getDashboard());
        return;
    }
    if (url.pathname === "/api/models") {
        const models = requireModelManager(res);
        if (!models)
            return;
        sendJson(res, 200, await models.dashboard());
        return;
    }
    if (url.pathname === "/api/image-generation") {
        const images = requireImageGeneration(res);
        if (!images)
            return;
        sendJson(res, 200, await images.getDashboard(url.searchParams.get("projectId") ?? undefined));
        return;
    }
    if (url.pathname === "/api/video-audio-generation") {
        const videoAudio = requireVideoAudioGeneration(res);
        if (!videoAudio)
            return;
        sendJson(res, 200, await videoAudio.getDashboard(url.searchParams.get("projectId") ?? undefined));
        return;
    }
    if (url.pathname === "/api/generation-optimization") {
        const optimization = requireGenerationOptimization(res);
        if (!optimization)
            return;
        sendJson(res, 200, await optimization.getDashboard(url.searchParams.get("projectId") ?? undefined));
        return;
    }
    if (url.pathname === "/api/product-intelligence") {
        const intelligence = requireProductIntelligence(res);
        if (!intelligence)
            return;
        sendJson(res, 200, await intelligence.getDashboard(url.searchParams.get("projectId") ?? undefined));
        return;
    }
    if (url.pathname === "/api/image-intelligence") {
        const intelligence = requireImageIntelligence(res);
        if (!intelligence)
            return;
        sendJson(res, 200, await intelligence.getDashboard(url.searchParams.get("projectId") ?? undefined));
        return;
    }
    if (url.pathname === "/api/marketing-intelligence") {
        const intelligence = requireMarketingIntelligence(res);
        if (!intelligence)
            return;
        sendJson(res, 200, await intelligence.getDashboard(url.searchParams.get("projectId") ?? undefined));
        return;
    }
    if (url.pathname === "/api/decision-intelligence") {
        const intelligence = requireDecisionIntelligence(res);
        if (!intelligence)
            return;
        sendJson(res, 200, await intelligence.getDashboard(url.searchParams.get("projectId") ?? undefined));
        return;
    }
    if (url.pathname === "/api/learning-intelligence") {
        const learning = requireLearningIntelligence(res);
        if (!learning)
            return;
        sendJson(res, 200, await learning.getDashboard(url.searchParams.get("projectId") ?? undefined));
        return;
    }
    const imageAnalysisMatch = url.pathname.match(/^\/api\/image-intelligence\/projects\/([^/]+)\/analyze$/);
    if (imageAnalysisMatch && req.method === "POST") {
        const intelligence = requireImageIntelligence(res);
        if (!intelligence)
            return;
        try {
            const profiles = await intelligence.analyzeProject(imageAnalysisMatch[1]);
            sendJson(res, 201, { profiles, dashboard: await intelligence.getDashboard(imageAnalysisMatch[1]) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Image analysis failed" });
        }
        return;
    }
    const productAnalysisMatch = url.pathname.match(/^\/api\/product-intelligence\/projects\/([^/]+)\/analyze$/);
    if (productAnalysisMatch && req.method === "POST") {
        const intelligence = requireProductIntelligence(res);
        if (!intelligence)
            return;
        try {
            const profile = await intelligence.analyze(productAnalysisMatch[1]);
            sendJson(res, 201, { profile, dashboard: await intelligence.getDashboard(productAnalysisMatch[1]) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Product analysis failed" });
        }
        return;
    }
    const marketingAnalysisMatch = url.pathname.match(/^\/api\/marketing-intelligence\/projects\/([^/]+)\/analyze$/);
    if (marketingAnalysisMatch && req.method === "POST") {
        const intelligence = requireMarketingIntelligence(res);
        if (!intelligence)
            return;
        try {
            const profile = await intelligence.analyze(marketingAnalysisMatch[1]);
            sendJson(res, 201, { profile, dashboard: await intelligence.getDashboard(marketingAnalysisMatch[1]) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Marketing analysis failed" });
        }
        return;
    }
    const decisionAnalysisMatch = url.pathname.match(/^\/api\/decision-intelligence\/projects\/([^/]+)\/decide$/);
    if (decisionAnalysisMatch && req.method === "POST") {
        const intelligence = requireDecisionIntelligence(res);
        if (!intelligence)
            return;
        try {
            const body = (await readBody(req)) || "{}";
            const decision = await intelligence.decide(decisionAnalysisMatch[1], JSON.parse(body).taskKind ?? "pipeline");
            sendJson(res, 201, { decision, dashboard: await intelligence.getDashboard(decisionAnalysisMatch[1]) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Decision analysis failed" });
        }
        return;
    }
    const learningProjectMatch = url.pathname.match(/^\/api\/learning-intelligence\/projects\/([^/]+)\/learn$/);
    if (learningProjectMatch && req.method === "POST") {
        const learning = requireLearningIntelligence(res);
        if (!learning)
            return;
        try {
            const body = JSON.parse((await readBody(req)) || "{}");
            const profile = await learning.learnFromProject(learningProjectMatch[1], body.outcome ?? "success", body.detail);
            sendJson(res, 201, { profile, dashboard: await learning.getDashboard(learningProjectMatch[1]) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Learning collection failed" });
        }
        return;
    }
    const learningFeedbackMatch = url.pathname.match(/^\/api\/learning-intelligence\/projects\/([^/]+)\/feedback$/);
    if (learningFeedbackMatch && req.method === "POST") {
        const learning = requireLearningIntelligence(res);
        if (!learning)
            return;
        try {
            const body = JSON.parse((await readBody(req)) || "{}");
            const profile = await learning.recordFeedback(learningFeedbackMatch[1], String(body.feedback ?? ""));
            sendJson(res, 201, { profile, dashboard: await learning.getDashboard(learningFeedbackMatch[1]) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Feedback learning failed" });
        }
        return;
    }
    if (url.pathname === "/api/generation-optimization/optimize" && req.method === "POST") {
        const optimization = requireGenerationOptimization(res);
        if (!optimization)
            return;
        try {
            const request = JSON.parse(await readBody(req));
            const task = await optimization.optimize(request);
            sendJson(res, 201, { task, dashboard: await optimization.getDashboard(request.projectId) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Optimization task failed" });
        }
        return;
    }
    if (url.pathname === "/api/generation-optimization/batch" && req.method === "POST") {
        const optimization = requireGenerationOptimization(res);
        if (!optimization)
            return;
        try {
            const body = JSON.parse(await readBody(req));
            const tasks = await optimization.batch.submit(body.requests ?? []);
            sendJson(res, 201, { tasks, dashboard: await optimization.getDashboard(body.projectId) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Optimization batch failed" });
        }
        return;
    }
    const optimizationRetryMatch = url.pathname.match(/^\/api\/generation-optimization\/tasks\/([^/]+)\/retry$/);
    if (optimizationRetryMatch && req.method === "POST") {
        const optimization = requireGenerationOptimization(res);
        if (!optimization)
            return;
        try {
            const task = await optimization.retry(optimizationRetryMatch[1]);
            sendJson(res, 200, { task, dashboard: await optimization.getDashboard(task.request.projectId) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Optimization retry failed" });
        }
        return;
    }
    const videoDefaultMatch = url.pathname.match(/^\/api\/video-audio-generation\/projects\/([^/]+)\/default$/);
    if (videoDefaultMatch && req.method === "GET") {
        const videoAudio = requireVideoAudioGeneration(res);
        if (!videoAudio)
            return;
        try {
            sendJson(res, 200, { request: await videoAudio.defaultRequest(videoDefaultMatch[1]) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to prepare video defaults" });
        }
        return;
    }
    if (url.pathname === "/api/video-audio-generation/generate" && req.method === "POST") {
        const videoAudio = requireVideoAudioGeneration(res);
        if (!videoAudio)
            return;
        try {
            const body = JSON.parse(await readBody(req));
            const generated = await videoAudio.generate(body);
            sendJson(res, 201, { package: generated, dashboard: await videoAudio.getDashboard(body.projectId) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Video and audio generation failed" });
        }
        return;
    }
    const videoAssetMatch = url.pathname.match(/^\/api\/video-audio-generation\/packages\/([^/]+)\/(preview|audio|subtitles)$/);
    if (videoAssetMatch && req.method === "GET") {
        const videoAudio = requireVideoAudioGeneration(res);
        if (!videoAudio)
            return;
        const filePath = await videoAudio.getAssetPath(videoAssetMatch[1], videoAssetMatch[2]);
        if (!filePath) {
            sendJson(res, 404, { error: "Generated video package asset not found" });
            return;
        }
        await serveStatic(res, filePath);
        return;
    }
    const imageDefaultMatch = url.pathname.match(/^\/api\/image-generation\/projects\/([^/]+)\/default$/);
    if (imageDefaultMatch && req.method === "GET") {
        const images = requireImageGeneration(res);
        if (!images)
            return;
        try {
            sendJson(res, 200, { request: await images.defaultRequest(imageDefaultMatch[1]) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to prepare generation defaults" });
        }
        return;
    }
    if (url.pathname === "/api/image-generation/generate" && req.method === "POST") {
        const images = requireImageGeneration(res);
        if (!images)
            return;
        try {
            const body = JSON.parse(await readBody(req));
            const generated = await images.generate(body);
            sendJson(res, 201, { images: generated, dashboard: await images.getDashboard(body.projectId) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Image generation failed" });
        }
        return;
    }
    const generatedAssetMatch = url.pathname.match(/^\/api\/image-generation\/assets\/([^/]+)$/);
    if (generatedAssetMatch && req.method === "GET") {
        const images = requireImageGeneration(res);
        if (!images)
            return;
        const filePath = await images.getAssetPath(generatedAssetMatch[1]);
        if (!filePath) {
            sendJson(res, 404, { error: "Generated image not found" });
            return;
        }
        await serveStatic(res, filePath);
        return;
    }
    if (url.pathname === "/api/models/settings" && req.method === "POST") {
        const models = requireModelManager(res);
        if (!models)
            return;
        try {
            const body = JSON.parse(await readBody(req));
            sendJson(res, 200, { settings: await models.settings.update(body) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to update model settings" });
        }
        return;
    }
    if (url.pathname === "/api/models/health" && req.method === "POST") {
        const models = requireModelManager(res);
        if (!models)
            return;
        await models.health.scan();
        sendJson(res, 200, await models.dashboard());
        return;
    }
    const modelActionMatch = url.pathname.match(/^\/api\/models\/([^/]+)\/(install|load|unload|update|remove|validate)$/);
    if (modelActionMatch && req.method === "POST") {
        const models = requireModelManager(res);
        if (!models)
            return;
        try {
            const body = JSON.parse(await readBody(req));
            const [, modelId, action] = modelActionMatch;
            if (action === "install")
                await models.installer.install(modelId, body.sourcePath);
            else if (action === "load")
                await models.loader.load(modelId);
            else if (action === "unload")
                await models.loader.unload(modelId);
            else if (action === "update")
                await models.updates.update(modelId, body.version ?? "");
            else if (action === "remove")
                await models.remove(modelId);
            else
                await models.validation.validate(models.getMutable(modelId));
            sendJson(res, 200, await models.dashboard());
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to manage model" });
        }
        return;
    }
    if (url.pathname === "/api/pipeline/jobs" && req.method === "POST") {
        const pipeline = requirePipeline(res);
        if (!pipeline)
            return;
        try {
            const body = JSON.parse(await readBody(req));
            if (!body.projectId) {
                sendJson(res, 400, { error: "projectId is required" });
                return;
            }
            const job = await pipeline.enqueue(body.projectId);
            sendJson(res, 202, { job, dashboard: pipeline.getDashboard() });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to queue creative pipeline" });
        }
        return;
    }
    const pipelineRetryMatch = url.pathname.match(/^\/api\/pipeline\/jobs\/([^/]+)\/retry$/);
    if (pipelineRetryMatch && req.method === "POST") {
        const pipeline = requirePipeline(res);
        if (!pipeline)
            return;
        try {
            const job = await pipeline.retry(pipelineRetryMatch[1]);
            sendJson(res, 200, { job, dashboard: pipeline.getDashboard() });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to retry creative pipeline" });
        }
        return;
    }
    const pipelineArtifactMatch = url.pathname.match(/^\/api\/pipeline\/projects\/([^/]+)\/artifacts$/);
    if (pipelineArtifactMatch && req.method === "POST") {
        const review = requireReview(res);
        if (!review)
            return;
        try {
            const body = JSON.parse(await readBody(req));
            const asset = await review.ingestAsset(pipelineArtifactMatch[1], { name: body.name ?? "Generated asset", mimeType: body.mimeType ?? "", dataBase64: body.dataBase64 ?? "" });
            sendJson(res, 201, { asset, review: await review.getProjectState(pipelineArtifactMatch[1]) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to register generated artifact" });
        }
        return;
    }
    const reviewMatch = url.pathname.match(/^\/api\/review\/projects\/([^/]+)$/);
    if (reviewMatch && req.method === "GET") {
        const review = requireReview(res);
        if (!review)
            return;
        sendJson(res, 200, { review: await review.getProjectState(reviewMatch[1]), integrations: review.getIntegrationStatus() });
        return;
    }
    const reviewAssetMatch = url.pathname.match(/^\/api\/review\/projects\/([^/]+)\/assets\/([^/]+)$/);
    if (reviewAssetMatch && req.method === "GET") {
        const review = requireReview(res);
        if (!review)
            return;
        const filePath = await review.getAssetPath(reviewAssetMatch[1], reviewAssetMatch[2]);
        if (!filePath) {
            sendJson(res, 404, { error: "Review asset not found" });
            return;
        }
        await serveStatic(res, filePath);
        return;
    }
    const downloadMatch = url.pathname.match(/^\/api\/review\/projects\/([^/]+)\/downloads\/([^/]+)$/);
    if (downloadMatch && req.method === "GET") {
        const review = requireReview(res);
        if (!review)
            return;
        const filePath = await review.getAssetPath(downloadMatch[1], decodeURIComponent(downloadMatch[2]), true);
        if (!filePath) {
            sendJson(res, 404, { error: "Export not found" });
            return;
        }
        await serveStatic(res, filePath);
        return;
    }
    const reviewActionMatch = url.pathname.match(/^\/api\/review\/projects\/([^/]+)\/(bootstrap|assets|approve|regenerate|export)$/);
    if (reviewActionMatch && req.method === "POST") {
        const review = requireReview(res);
        if (!review)
            return;
        try {
            const projectId = reviewActionMatch[1];
            const action = reviewActionMatch[2];
            const body = JSON.parse(await readBody(req));
            if (action === "bootstrap") {
                const workspace = requireWorkspace(res);
                if (!workspace)
                    return;
                const project = await workspace.getProject(projectId);
                if (!project) {
                    sendJson(res, 404, { error: "Project not found" });
                    return;
                }
                const images = await Promise.all(project.productImages.map(async (image) => {
                    const imagePath = await workspace.getImagePath(projectId, image.url.split("/").pop() ?? "");
                    return imagePath ? { name: image.fileName, mimeType: image.mimeType, dataBase64: fs.readFileSync(imagePath).toString("base64") } : null;
                }));
                sendJson(res, 200, { review: await review.bootstrapProductImages(project, images.filter((image) => image !== null)) });
            }
            else if (action === "assets") {
                const asset = await review.ingestAsset(projectId, { name: body.name ?? "Generated asset", mimeType: body.mimeType ?? "", dataBase64: body.dataBase64 ?? "" });
                sendJson(res, 201, { asset, review: await review.getProjectState(projectId) });
            }
            else if (action === "approve") {
                const asset = await review.approve(projectId, body.assetId ?? "");
                sendJson(res, 200, { asset, review: await review.getProjectState(projectId) });
            }
            else if (action === "regenerate") {
                sendJson(res, 202, { review: await review.requestRegeneration(projectId, body.assetId ?? "", body.instructions) });
            }
            else {
                const result = await review.exportAsset(projectId, body.assetId ?? "", { format: body.format, platform: body.platform ?? "instagram", resolution: body.resolution ?? "source", quality: body.quality ?? "high" });
                sendJson(res, 200, result);
            }
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to process review action" });
        }
        return;
    }
    const planMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/plan$/);
    if (planMatch && req.method === "GET") {
        const planning = requirePlanning(res);
        if (!planning)
            return;
        sendJson(res, 200, { plan: await planning.getPlan(planMatch[1]), integrations: planning.getIntegrationStatus() });
        return;
    }
    if (planMatch && req.method === "POST") {
        const planning = requirePlanning(res);
        const workspace = requireWorkspace(res);
        if (!planning || !workspace)
            return;
        try {
            const body = JSON.parse(await readBody(req));
            if (body.action === "generate") {
                const project = await workspace.getProject(planMatch[1]);
                if (!project) {
                    sendJson(res, 404, { error: "Project not found" });
                    return;
                }
                const result = await planning.createPlan(project, workspace.validate(project));
                if (!result.plan) {
                    sendJson(res, 422, { error: "Complete required workspace inputs before planning.", validation: result.validation });
                    return;
                }
                sendJson(res, 201, result);
            }
            else {
                const plan = await planning.updatePlan(planMatch[1], body.changes ?? {});
                sendJson(res, 200, { plan });
            }
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to save creative plan" });
        }
        return;
    }
    if (url.pathname === "/api/workspace/projects" && req.method === "POST") {
        const workspace = requireWorkspace(res);
        if (!workspace)
            return;
        try {
            const body = JSON.parse(await readBody(req));
            const project = await workspace.createProject(body.name ?? "");
            sendJson(res, 201, { project, validation: workspace.validate(project) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to create project" });
        }
        return;
    }
    const projectMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)$/);
    if (projectMatch && req.method === "GET") {
        const workspace = requireWorkspace(res);
        if (!workspace)
            return;
        const project = await workspace.getProject(projectMatch[1]);
        if (!project) {
            sendJson(res, 404, { error: "Project not found" });
            return;
        }
        sendJson(res, 200, { project, validation: workspace.validate(project) });
        return;
    }
    if (projectMatch && req.method === "POST") {
        const workspace = requireWorkspace(res);
        if (!workspace)
            return;
        try {
            const body = JSON.parse(await readBody(req));
            const project = body.action === "open"
                ? await workspace.openProject(projectMatch[1])
                : await workspace.updateProject(projectMatch[1], body.changes ?? {});
            sendJson(res, 200, { project, validation: workspace.validate(project) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to save project" });
        }
        return;
    }
    const imageMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/images\/([^/]+)$/);
    if (imageMatch && req.method === "GET") {
        const workspace = requireWorkspace(res);
        if (!workspace)
            return;
        const imagePath = await workspace.getImagePath(imageMatch[1], imageMatch[2]);
        if (!imagePath) {
            sendJson(res, 404, { error: "Product image not found" });
            return;
        }
        await serveStatic(res, imagePath);
        return;
    }
    const uploadMatch = url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/images$/);
    if (uploadMatch && req.method === "POST") {
        const workspace = requireWorkspace(res);
        if (!workspace)
            return;
        try {
            const body = JSON.parse(await readBody(req));
            const image = await workspace.uploadImage(uploadMatch[1], {
                fileName: body.fileName ?? "product-image",
                mimeType: body.mimeType ?? "",
                dataBase64: body.dataBase64 ?? "",
            });
            const project = await workspace.getProject(uploadMatch[1]);
            sendJson(res, 201, { image, project, validation: workspace.validate(project) });
        }
        catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : "Unable to upload image" });
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
            const body = JSON.parse(await readBody(req));
            store.updateUi({
                filter: body.filter ?? store.get().ui.filter,
                openPhases: body.openPhases ?? store.get().ui.openPhases,
            });
            sendJson(res, 200, { ok: true, ui: store.get().ui });
        }
        catch {
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
        if (!phase) {
            sendJson(res, 404, { error: "Engine not found" });
            return;
        }
        const result = await runEngineQuickTest(phase.engine);
        sendJson(res, 200, result);
        return;
    }
    const smokeMatch = url.pathname.match(/^\/api\/modules\/([^/]+)\/smoke-test$/);
    if (req.method === "POST" && smokeMatch) {
        const mod = findModule(smokeMatch[1]);
        if (!mod?.aiPath) {
            sendJson(res, 404, { error: "Module not found" });
            return;
        }
        const result = await runSmokeTest(mod.aiPath);
        sendJson(res, 200, result);
        return;
    }
    const validateMatch = url.pathname.match(/^\/api\/modules\/([^/]+)\/validate$/);
    if (req.method === "POST" && validateMatch) {
        const mod = findModule(validateMatch[1]);
        if (!mod?.validateKey) {
            sendJson(res, 404, { error: "Validation script not found" });
            return;
        }
        const result = await runValidationScript(mod.validateKey);
        if (result.success)
            invalidateRegistryCache();
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
function openBrowser(address) {
    if (process.env.KWIZERA_SKIP_BROWSER_OPEN === "1")
        return;
    if (process.platform === "win32") {
        spawn("cmd", ["/c", "start", "chrome", address], { detached: true, stdio: "ignore" }).unref();
    }
}
function printStartupBanner(port, restored) {
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
function startListening(port) {
    server.once("error", (err) => {
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
async function main() {
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
//# sourceMappingURL=index.js.map
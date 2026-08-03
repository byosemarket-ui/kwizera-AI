import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const STAGES = ["validation", "analysis", "planning", "prompt-generation", "generation", "rendering", "review", "export"];
/** Coordinates the existing creative modules; it does not replace generation or rendering engines. */
export class CreativePipelineManager {
    root = "";
    core = null;
    workspace = null;
    planning = null;
    review = null;
    optimization = null;
    productIntelligenceRuntime = null;
    imageIntelligenceRuntime = null;
    marketingIntelligenceRuntime = null;
    decisionIntelligenceRuntime = null;
    learningIntelligenceRuntime = null;
    imageGenerationRuntime = null;
    videoAudioGenerationRuntime = null;
    store = { jobs: [], history: [] };
    running = new Set();
    async initialize(storageRoot, dependencies) {
        this.root = path.join(storageRoot, "creative-pipeline");
        this.core = dependencies.core;
        this.workspace = dependencies.workspace;
        this.planning = dependencies.planning;
        this.review = dependencies.review;
        await fs.mkdir(this.root, { recursive: true });
        this.store = await this.readStore();
        for (const job of this.store.jobs.filter((item) => item.status === "queued" || item.status === "running")) {
            job.status = "queued";
            this.note(job, "warning", "Pipeline resumed after interruption from the last checkpoint.");
            void this.run(job.id);
        }
        await this.save();
    }
    async enqueue(projectId) {
        this.ensureReady();
        const active = this.store.jobs.find((job) => job.projectId === projectId && (job.status === "queued" || job.status === "running"));
        if (active)
            return active;
        const now = new Date().toISOString();
        const job = { id: randomUUID(), projectId, stage: "validation", progress: 0, status: "queued", createdAt: now, updatedAt: now, retryCount: 0, notifications: [], completedStages: [] };
        this.note(job, "info", "Pipeline queued for automatic execution.");
        this.store.jobs.unshift(job);
        await this.save();
        await this.run(job.id);
        return job;
    }
    attachGenerationOptimization(manager) { this.optimization = manager; }
    attachProductIntelligence(manager) { this.productIntelligenceRuntime = manager; }
    attachImageIntelligence(manager) { this.imageIntelligenceRuntime = manager; }
    attachMarketingIntelligence(manager) { this.marketingIntelligenceRuntime = manager; }
    attachDecisionIntelligence(manager) { this.decisionIntelligenceRuntime = manager; }
    attachLearningIntelligence(manager) { this.learningIntelligenceRuntime = manager; }
    attachImageGeneration(manager) { this.imageGenerationRuntime = manager; }
    attachVideoAudioGeneration(manager) { this.videoAudioGenerationRuntime = manager; }
    async run(jobId) {
        this.ensureReady();
        const job = this.requireJob(jobId);
        if (this.running.has(jobId) || job.status === "completed")
            return job;
        this.running.add(jobId);
        job.status = "running";
        job.startedAt ??= new Date().toISOString();
        try {
            const project = await this.workspace.getProject(job.projectId);
            if (!project)
                throw new Error("Project no longer exists");
            if (this.decisionIntelligenceRuntime) {
                const decision = await this.decisionIntelligenceRuntime.decide(project.id, "pipeline");
                this.note(job, "info", `Decision Intelligence selected ${decision.selected.label} at ${decision.confidence}% confidence.`);
            }
            for (const stage of STAGES) {
                if (job.completedStages.includes(stage))
                    continue;
                job.stage = stage;
                job.updatedAt = new Date().toISOString();
                await this.save();
                await this.executeStage(job, project, stage);
                job.completedStages.push(stage);
                job.progress = Math.round((job.completedStages.length / STAGES.length) * 100);
                this.note(job, "info", `${stage.replace(/-/g, " ")} completed.`);
                await this.save();
            }
            job.stage = "completed";
            job.status = "completed";
            job.progress = 100;
            job.completedAt = new Date().toISOString();
            this.note(job, "info", "Creative pipeline completed and project export saved.");
            this.store.jobs = this.store.jobs.filter((item) => item.id !== job.id);
            this.store.history.unshift(structuredClone(job));
            await this.learningIntelligenceRuntime?.learnFromProject(project.id, "success");
            await this.save();
        }
        catch (error) {
            job.retryCount += 1;
            job.status = "failed";
            job.stage = "failed";
            job.error = error instanceof Error ? error.message : String(error);
            this.note(job, "error", `Pipeline paused: ${job.error}`);
            await this.learningIntelligenceRuntime?.learnFromProject(job.projectId, "failure", job.error);
            await this.save();
        }
        finally {
            this.running.delete(jobId);
        }
        return job;
    }
    async retry(jobId) {
        const job = this.requireJob(jobId);
        job.status = "queued";
        job.stage = job.completedStages.at(-1) ?? "validation";
        job.error = undefined;
        this.note(job, "warning", "Retry requested; resuming from the last completed stage.");
        await this.save();
        return this.run(jobId);
    }
    getDashboard() {
        const usage = process.memoryUsage();
        const completed = this.store.history.length;
        const failed = [...this.store.jobs, ...this.store.history].filter((job) => job.status === "failed").length;
        return { jobs: structuredClone(this.store.jobs), history: structuredClone(this.store.history), monitor: { pipelineHealth: failed ? "warning" : "healthy", activeJobs: this.running.size, queuedJobs: this.store.jobs.filter((job) => job.status === "queued").length, memoryMb: Math.round(usage.rss / 1024 / 1024), cpuUsage: process.cpuUsage().user, successRate: completed ? Math.round((completed / (completed + failed)) * 100) : 100, estimatedCompletion: this.store.jobs.length ? "In progress" : "Idle" }, integrations: this.integrations() };
    }
    async executeStage(job, project, stage) {
        if (stage === "validation") {
            const result = this.workspace.validate(project);
            if (!result.valid)
                throw new Error(result.errors.join(" "));
            return;
        }
        if (stage === "analysis") {
            const imageProfiles = this.imageIntelligenceRuntime ? await this.imageIntelligenceRuntime.analyzeProject(project.id) : [];
            const profile = this.productIntelligenceRuntime ? await this.productIntelligenceRuntime.analyze(project.id) : null;
            const marketing = this.marketingIntelligenceRuntime ? await this.marketingIntelligenceRuntime.analyze(project.id) : null;
            this.note(job, "info", profile ? `Image intelligence analyzed ${imageProfiles.length} uploaded image(s); product profile ready: ${profile.identifiedAs}, ${profile.viewCount} view(s), quality ${profile.quality.score}/100.${marketing ? ` Marketing strategy ready at ${marketing.score}/100.` : ""}` : "Product, brand, campaign, audience, platform, and language inputs handed to planning intelligence.");
            return;
        }
        if (stage === "planning" || stage === "prompt-generation") {
            const result = await this.planning.createPlan(project, this.workspace.validate(project));
            if (!result.plan)
                throw new Error("Creative planning could not be completed");
            return;
        }
        if (stage === "generation") {
            if (!this.imageGenerationRuntime || !this.videoAudioGenerationRuntime) {
                this.note(job, "warning", "Generation runtimes are not attached; source-media review fallback remains active.");
                return;
            }
            const imageDefaults = await this.imageGenerationRuntime.defaultRequest(project.id);
            const images = await this.imageGenerationRuntime.generate({
                projectId: project.id,
                prompt: imageDefaults.prompt ?? `${project.productInformation.name} product composition`,
                mode: imageDefaults.mode ?? "product-to-image",
                style: imageDefaults.style ?? "studio",
                aspectRatio: imageDefaults.aspectRatio ?? "1:1",
                resolution: imageDefaults.resolution ?? "high",
                count: 1,
                productImageId: imageDefaults.productImageId,
            });
            const videoDefaults = await this.videoAudioGenerationRuntime.defaultRequest(project.id);
            const video = await this.videoAudioGenerationRuntime.generate({
                projectId: project.id,
                prompt: videoDefaults.prompt ?? `${project.productInformation.name} marketing video`,
                mode: videoDefaults.mode ?? "image-to-video",
                imageId: images[0]?.id ?? videoDefaults.imageId,
                durationSeconds: videoDefaults.durationSeconds ?? 15,
                resolution: videoDefaults.resolution ?? "1080p",
                frameRate: videoDefaults.frameRate ?? 30,
                voice: videoDefaults.voice ?? "narrator",
                music: videoDefaults.music ?? "uplifting",
                soundEffects: videoDefaults.soundEffects ?? true,
                subtitles: videoDefaults.subtitles ?? true,
            });
            this.note(job, "info", `Generated ${images.length} image preview(s) and video package ${video.id}.`);
            return;
        }
        if (stage === "rendering") {
            if (!this.videoAudioGenerationRuntime) {
                this.note(job, "warning", "Video/audio runtime is not attached; source-media review fallback remains active.");
                return;
            }
            const packageResult = (await this.videoAudioGenerationRuntime.getDashboard(project.id)).packages[0];
            if (!packageResult)
                throw new Error("No generated video package is available for rendering");
            const audioPath = await this.videoAudioGenerationRuntime.getAssetPath(packageResult.id, "audio");
            if (!audioPath)
                throw new Error("Generated video package audio artifact is unavailable");
            const reviewState = await this.review.getProjectState(project.id);
            if (!reviewState.assets.some((asset) => asset.name === `${packageResult.name} audio`)) {
                await this.review.ingestAsset(project.id, { name: `${packageResult.name} audio`, mimeType: "audio/wav", dataBase64: (await fs.readFile(audioPath)).toString("base64") });
            }
            this.note(job, "info", `Rendered audio artifact from video package ${packageResult.id} into review.`);
            return;
        }
        if (stage === "review") {
            const reviewState = await this.review.getProjectState(project.id);
            if (!reviewState.assets.length) {
                const images = await Promise.all(project.productImages.map(async (image) => {
                    const imagePath = await this.workspace.getImagePath(project.id, image.url.split("/").pop() ?? "");
                    return imagePath ? { name: image.fileName, mimeType: image.mimeType, dataBase64: (await fs.readFile(imagePath)).toString("base64") } : null;
                }));
                await this.review.bootstrapProductImages(project, images.filter((image) => image !== null));
            }
            const asset = (await this.review.getProjectState(project.id)).assets[0];
            if (!asset)
                throw new Error("No generated or source media artifact is available for review");
            if (!asset.approved)
                await this.review.approve(project.id, asset.id);
            return;
        }
        if (stage === "export") {
            const reviewState = await this.review.getProjectState(project.id);
            const asset = reviewState.assets.find((item) => item.approved);
            if (!asset)
                throw new Error("No approved artifact is available for export");
            const format = formatFor(asset.mimeType);
            if (!format)
                throw new Error("Approved artifact does not have a supported export format");
            await this.review.exportAsset(project.id, asset.id, { format, platform: project.platform, resolution: "source", quality: "high" });
        }
    }
    note(job, level, message) { job.notifications.unshift({ at: new Date().toISOString(), level, message }); job.updatedAt = new Date().toISOString(); }
    requireJob(id) { const job = this.store.jobs.find((item) => item.id === id); if (!job)
        throw new Error("Pipeline job not found"); return job; }
    integrations() { return { aiCore: Boolean(this.core), moduleManager: Boolean(this.core?.moduleManager), stateManager: Boolean(this.core?.stateManager), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), decisionFoundation: Boolean(this.core?.decisionEngine), decisionIntelligenceRuntime: Boolean(this.decisionIntelligenceRuntime?.isInitialized()), learningIntelligenceRuntime: Boolean(this.learningIntelligenceRuntime?.isInitialized()), productIntelligence: Boolean(this.core?.productIntelligenceFoundation), productIntelligenceRuntime: Boolean(this.productIntelligenceRuntime?.isInitialized()), imageIntelligence: Boolean(this.core?.imageIntelligenceFoundation), imageIntelligenceRuntime: Boolean(this.imageIntelligenceRuntime?.isInitialized()), marketingIntelligenceRuntime: Boolean(this.marketingIntelligenceRuntime?.isInitialized()), videoIntelligence: Boolean(this.core?.videoIntelligenceFoundation), modelManagement: Boolean(this.core?.modelManager), imageGeneration: Boolean(this.imageGenerationRuntime), videoAudioGeneration: Boolean(this.videoAudioGenerationRuntime), generationOptimization: Boolean(this.optimization?.isInitialized()), generationManager: Boolean(this.imageGenerationRuntime || this.videoAudioGenerationRuntime), renderingPipeline: Boolean(this.videoAudioGenerationRuntime), previewSystem: Boolean(this.review), exportSystem: Boolean(this.review) }; }
    async readStore() { try {
        return JSON.parse(await fs.readFile(path.join(this.root, "pipeline.json"), "utf8"));
    }
    catch (error) {
        if (error.code === "ENOENT")
            return { jobs: [], history: [] };
        throw error;
    } }
    async save() { await fs.writeFile(path.join(this.root, "pipeline.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); }
    ensureReady() { if (!this.root || !this.workspace || !this.planning || !this.review)
        throw new Error("Creative Pipeline Manager is not initialized"); }
}
function formatFor(mimeType) { return { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "audio/mpeg": "mp3", "audio/wav": "wav" }[mimeType] ?? null; }
//# sourceMappingURL=creative-pipeline-manager.js.map
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const EMPTY = { packages: [], history: [], cache: {}, logs: [] };
/** Produces a durable marketing-video package. The preview encoder can be replaced by an MP4/WebM provider later. */
export class VideoAudioGenerationManager {
    root = "";
    core = null;
    models = null;
    workspace = null;
    planning = null;
    images = null;
    productIntelligence = null;
    imageIntelligence = null;
    marketingIntelligence = null;
    decisionIntelligence = null;
    learningIntelligence = null;
    store = structuredClone(EMPTY);
    videoGenerator = new AiVideoGenerator(this);
    videoModelSelector = new VideoModelSelector(this);
    videoModelExecutor = new VideoModelExecutor(this);
    imageToVideo = new ImageToVideoEngine(this);
    textToVideo = new TextToVideoEngine(this);
    productToVideo = new ProductToVideoEngine(this);
    sceneAnimation = new SceneAnimationEngine(this);
    cameraMotion = new CameraMotionEngine(this);
    transition = new TransitionEngine(this);
    timeline = new TimelineManager(this);
    audio = new AudioGenerationManager(this);
    voice = new AiVoiceGenerator(this);
    music = new BackgroundMusicManager(this);
    effects = new SoundEffectsManager(this);
    subtitles = new SubtitleGenerator(this);
    synchronization = new AudioSynchronizationManager(this);
    quality = new VideoQualityManager(this);
    metadata = new VideoMetadataManager(this);
    history = new VideoHistoryManager(this);
    async initialize(storageRoot, dependencies) { this.root = path.join(storageRoot, "video-audio-generation-runtime"); this.core = dependencies.core; this.models = dependencies.models; this.workspace = dependencies.workspace; this.planning = dependencies.planning; this.images = dependencies.images; await fs.mkdir(path.join(this.root, "assets"), { recursive: true }); this.store = await this.readStore(); this.log("info", "Video and audio generation runtime restored."); await this.persist(); }
    isInitialized() { return Boolean(this.root); }
    attachProductIntelligence(manager) { this.productIntelligence = manager; }
    attachImageIntelligence(manager) { this.imageIntelligence = manager; }
    attachMarketingIntelligence(manager) { this.marketingIntelligence = manager; }
    attachDecisionIntelligence(manager) { this.decisionIntelligence = manager; }
    attachLearningIntelligence(manager) { this.learningIntelligence = manager; }
    async generate(request) {
        if (request.projectId)
            await this.decisionIntelligence?.decide(request.projectId, "video-generation");
        this.ensureReady();
        this.validate(request);
        const key = createHash("sha256").update(JSON.stringify(request)).digest("hex");
        const existing = this.store.cache[key] ? this.store.packages.find((item) => item.id === this.store.cache[key]) : undefined;
        if (existing)
            return { ...existing, cached: true };
        const [videoModel, audioModel] = await Promise.all([this.videoModelSelector.select(request.videoModelId), this.audio.selectModel(request.audioModelId)]);
        await Promise.all([this.videoModelExecutor.load(videoModel.id), this.audio.load(audioModel.id)]);
        const packageResult = await this.createPackage(request, videoModel.id, audioModel.id);
        this.store.packages.unshift(packageResult);
        this.store.cache[key] = packageResult.id;
        this.history.record("generation", `Generated ${request.mode} package with synchronized audio and timeline.`, [packageResult.id]);
        this.log("info", `Generated ${packageResult.name}.`);
        await this.persist();
        if (request.projectId)
            await this.learningIntelligence?.learnFromProject(request.projectId, "success", `Video/audio package completed: ${request.mode}, ${packageResult.durationSeconds}s, local quality ${packageResult.quality.score}/100.`).catch((error) => this.log("warning", `Learning collection deferred: ${error instanceof Error ? error.message : String(error)}`));
        return { ...packageResult };
    }
    async getDashboard(projectId) { this.ensureReady(); const packages = this.store.packages.filter((item) => !projectId || item.projectId === projectId); const imageDashboard = await this.images.getDashboard(projectId); return { packages: packages.map((item) => ({ ...item })), history: [...this.store.history], logs: [...this.store.logs], models: this.models.list().filter((model) => (model.category === "video" || model.category === "audio" || model.category === "voice") && model.status !== "removed"), images: imageDashboard.images, integrations: { aiCore: Boolean(this.core), modelManagement: Boolean(this.models), imageGeneration: Boolean(this.images), videoGenerationFoundation: Boolean(this.core?.videoGenerationFoundation), audioGenerationFoundation: Boolean(this.core?.audioGenerationFoundation), videoIntelligence: Boolean(this.core?.videoIntelligenceFoundation), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), productIntelligence: Boolean(this.core?.productIntelligenceFoundation), imageIntelligence: Boolean(this.core?.imageIntelligenceFoundation), stateManager: Boolean(this.core?.stateManager), moduleManager: Boolean(this.core?.moduleManager), creativePipeline: Boolean(this.core?.workflowEngine) }, statistics: { generatedPackages: this.store.packages.length, cachedRequests: Object.keys(this.store.cache).length, averageQuality: this.store.packages.length ? Math.round(this.store.packages.reduce((sum, item) => sum + item.quality.score, 0) / this.store.packages.length) : 0 } }; }
    async defaultRequest(projectId) { const [project, plan, profile, imageProfiles, marketing, imageDashboard] = await Promise.all([this.workspace.getProject(projectId), this.planning.getPlan(projectId), this.productIntelligence?.getProfile(projectId), this.imageIntelligence?.getProfiles(projectId), this.marketingIntelligence?.getProfile(projectId), this.images.getDashboard(projectId)]); const imageProfile = imageProfiles?.[0]; if (!project)
        throw new Error("Project not found"); const image = imageDashboard.images[0]; return { projectId, prompt: plan?.prompts.video ?? `${project.productInformation.name} ${profile ? `${profile.category} ${profile.shapes.join(" ")}` : ""}${imageProfile ? `, ${imageProfile.cameraAngle}` : ""}${marketing ? `, ${marketing.strategy}, CTA: ${marketing.ctas[0]}` : ""} marketing video`, mode: image ? "image-to-video" : project.productImages.length ? "product-to-video" : "text-to-video", imageId: image?.id, durationSeconds: 15, resolution: "1080p", frameRate: 30, voice: "narrator", music: "uplifting", soundEffects: true, subtitles: true }; }
    async getAssetPath(packageId, kind) { const item = this.store.packages.find((entry) => entry.id === packageId); const fileName = kind === "preview" ? item?.previewFileName : kind === "audio" ? item?.audioFileName : item?.subtitleFileName; if (!fileName)
        return null; const target = path.join(this.root, "assets", fileName); try {
        await fs.access(target);
        return target;
    }
    catch {
        return null;
    } }
    async createPackage(request, videoModelId, audioModelId) { const project = request.projectId ? await this.workspace.getProject(request.projectId) : null; const plan = request.projectId ? await this.planning.getPlan(request.projectId) : null; const image = request.imageId ? (await this.images.getDashboard(request.projectId)).images.find((item) => item.id === request.imageId) : undefined; const id = randomUUID(); const timeline = this.timeline.build(plan?.scenes ?? [], request.durationSeconds, project?.productInformation.name ?? "Creative concept", request.prompt); const previewFileName = `${id}.svg`; const audioFileName = `${id}.wav`; const subtitleFileName = request.subtitles ? `${id}.vtt` : undefined; await fs.writeFile(path.join(this.root, "assets", previewFileName), this.videoGenerator.compose({ request, timeline, brand: project?.brandInformation.name ?? "KWIZERA", imageUrl: image ? `/api/image-generation/assets/${image.id}` : undefined }), "utf8"); await fs.writeFile(path.join(this.root, "assets", audioFileName), this.audio.synthesize(request, timeline)); if (subtitleFileName)
        await fs.writeFile(path.join(this.root, "assets", subtitleFileName), this.subtitles.create(timeline), "utf8"); return { id, projectId: request.projectId, name: `${project?.name ?? "Creative"} video package`, mode: request.mode, prompt: request.prompt, createdAt: new Date().toISOString(), durationSeconds: request.durationSeconds, resolution: request.resolution, frameRate: request.frameRate, videoModelId, audioModelId, previewFileName, audioFileName, subtitleFileName, imageId: image?.id, timeline, quality: this.quality.score(request, Boolean(image)), metadata: this.metadata.create(request, timeline.length), cached: false }; }
    log(level, message) { this.store.logs.unshift({ at: new Date().toISOString(), level, message }); this.store.logs.splice(100); this.core?.logger.info("generation", message); }
    async persist() { await fs.writeFile(path.join(this.root, "generation.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); }
    validate(request) { if (request.prompt.trim().length < 8)
        throw new Error("Provide a descriptive video prompt of at least 8 characters"); if (!Number.isInteger(request.durationSeconds) || request.durationSeconds < 3 || request.durationSeconds > 60)
        throw new Error("Video duration must be between 3 and 60 seconds"); }
    async readStore() { try {
        const value = JSON.parse(await fs.readFile(path.join(this.root, "generation.json"), "utf8"));
        return { ...structuredClone(EMPTY), ...value, packages: value.packages ?? [], history: value.history ?? [], cache: value.cache ?? {}, logs: value.logs ?? [] };
    }
    catch (error) {
        if (error.code === "ENOENT")
            return structuredClone(EMPTY);
        throw error;
    } }
    ensureReady() { if (!this.root || !this.models || !this.workspace || !this.planning || !this.images)
        throw new Error("Video and Audio Generation Manager is not initialized"); }
}
export class VideoModelSelector {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async select(requested) { let model = requested ? this.manager["models"].getMutable(requested) : await this.manager["models"].selectBest("video"); if (!model) {
        await this.manager["models"].installer.install("studio-video-base");
        model = this.manager["models"].getMutable("studio-video-base");
    } if (model.category !== "video")
        throw new Error("Selected model does not support video generation"); return model; }
}
export class VideoModelExecutor {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async load(id) { if (this.manager["models"].getMutable(id).status !== "loaded")
        await this.manager["models"].loader.load(id); }
}
export class AiVideoGenerator {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    compose(input) { const w = input.request.resolution === "1080p" ? 1920 : 1280; const h = w * 9 / 16; const scenes = input.timeline.map((scene, index) => `<g opacity="0"><set attributeName="opacity" to="1" begin="${scene.start}s" dur="${Math.max(1, scene.end - scene.start)}s"/><rect width="${w}" height="${h}" fill="${index % 2 ? "#16233a" : "#0c1422"}"/>${input.imageUrl ? `<image href="${input.imageUrl}" x="${w * .54}" y="${h * .12}" width="${w * .38}" height="${h * .76}" preserveAspectRatio="xMidYMid meet"><animate attributeName="x" from="${w * .57}" to="${w * .51}" dur="${Math.max(2, scene.end - scene.start)}s" fill="freeze"/></image>` : `<circle cx="${w * .7}" cy="${h * .5}" r="${w * .13}" fill="#e6a74a"><animate attributeName="r" values="${w * .11};${w * .15};${w * .11}" dur="2s" repeatCount="indefinite"/></circle>`}<text x="${w * .1}" y="${h * .2}" fill="#f7e7ce" font-family="Arial" font-size="${w * .035}" font-weight="700">${xml(input.brand).toUpperCase()}</text><text x="${w * .1}" y="${h * .46}" fill="#fff" font-family="Arial" font-size="${w * .055}" font-weight="700">${xml(scene.visual).slice(0, 55)}</text><text x="${w * .1}" y="${h * .58}" fill="#d6dde8" font-family="Arial" font-size="${w * .025}">${xml(scene.narration).slice(0, 95)}</text></g>`).join(""); return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${scenes}</svg>`; }
}
export class ImageToVideoEngine {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class TextToVideoEngine {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class ProductToVideoEngine {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class SceneAnimationEngine {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class CameraMotionEngine {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class TransitionEngine {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class TimelineManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    build(scenes, duration, fallbackName, prompt) { const source = scenes.length ? scenes : [{ durationSeconds: duration, narration: prompt, visual: fallbackName }]; const total = source.reduce((sum, scene) => sum + scene.durationSeconds, 0); let cursor = 0; return source.map((scene, index) => { const allocated = index === source.length - 1 ? duration - cursor : Math.max(1, Math.round(duration * scene.durationSeconds / total)); const entry = { scene: index + 1, start: cursor, end: cursor + allocated, narration: scene.narration, visual: scene.visual }; cursor += allocated; return entry; }); }
}
export class AudioGenerationManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async selectModel(requested) { let model = requested ? this.manager["models"].getMutable(requested) : await this.manager["models"].selectBest("audio"); if (!model) {
        await this.manager["models"].installer.install("studio-audio-base");
        model = this.manager["models"].getMutable("studio-audio-base");
    } if (model.category !== "audio")
        throw new Error("Selected model does not support audio generation"); return model; }
    async load(id) { if (this.manager["models"].getMutable(id).status !== "loaded")
        await this.manager["models"].loader.load(id); }
    synthesize(request, timeline) { const sampleRate = 8000; const samples = sampleRate * request.durationSeconds; const output = Buffer.alloc(44 + samples * 2); writeWavHeader(output, samples, sampleRate); for (let index = 0; index < samples; index++) {
        const time = index / sampleRate;
        const voice = request.voice === "energetic" ? Math.sin(time * 2 * Math.PI * 220) : Math.sin(time * 2 * Math.PI * 150);
        const music = request.music === "none" ? 0 : Math.sin(time * 2 * Math.PI * (request.music === "bold" ? 92 : 70));
        const effect = request.soundEffects && timeline.some((scene) => Math.abs(time - scene.start) < .04) ? .5 : 0;
        output.writeInt16LE(Math.max(-1, Math.min(1, voice * .18 + music * .1 + effect)) * 32767, 44 + index * 2);
    } return output; }
}
export class AiVoiceGenerator {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class BackgroundMusicManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class SoundEffectsManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class SubtitleGenerator {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    create(timeline) { return `WEBVTT\n\n${timeline.map((scene, index) => `${index + 1}\n${time(scene.start)} --> ${time(scene.end)}\n${scene.narration}\n`).join("\n")}`; }
}
export class AudioSynchronizationManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class VideoQualityManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    score(request, hasImage) { return { score: Math.min(98, 76 + (hasImage ? 8 : 0) + (request.subtitles ? 5 : 0) + (request.music !== "none" ? 4 : 0)), notes: [hasImage ? "Image asset animated on the production timeline." : "Text-led animated production preview generated.", "Audio mix, subtitles, scene timing, and brand treatment are synchronized."] }; }
}
export class VideoMetadataManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    create(request, sceneCount) { return { provider: "local-video-package-composer", sceneCount, subtitleEnabled: String(request.subtitles), audioSync: "timeline-aligned", generatedAt: new Date().toISOString() }; }
}
export class VideoHistoryManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    record(event, detail, packageIds) { this.manager["store"].history.unshift({ id: randomUUID(), at: new Date().toISOString(), event, detail, packageIds }); }
}
function writeWavHeader(output, samples, sampleRate) { output.write("RIFF", 0); output.writeUInt32LE(36 + samples * 2, 4); output.write("WAVEfmt ", 8); output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(1, 22); output.writeUInt32LE(sampleRate, 24); output.writeUInt32LE(sampleRate * 2, 28); output.writeUInt16LE(2, 32); output.writeUInt16LE(16, 34); output.write("data", 36); output.writeUInt32LE(samples * 2, 40); }
function time(value) { const minutes = Math.floor(value / 60); const seconds = Math.floor(value % 60); const milliseconds = Math.round((value % 1) * 1000); return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`; }
function xml(value) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;"); }
//# sourceMappingURL=video-audio-generation-manager.js.map
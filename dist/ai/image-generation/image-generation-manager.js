import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const EMPTY_STORE = { images: [], history: [], cache: {}, logs: [] };
const STYLE_PALETTES = { studio: ["#0d1b2a", "#1b4965", "#e0fbfc"], luxury: ["#14110f", "#8a6d3b", "#f7e7ce"], editorial: ["#17202a", "#c0392b", "#f7f9f9"], minimal: ["#f4f6f7", "#aeb6bf", "#1c2833"], bold: ["#111827", "#e11d48", "#fef08a"], lifestyle: ["#12343b", "#dca15d", "#f5ead7"] };
/** Executes safe, local marketing-image composition. A provider can replace the SVG renderer without changing this contract. */
export class ImageGenerationManager {
    root = "";
    core = null;
    models = null;
    workspace = null;
    planning = null;
    store = structuredClone(EMPTY_STORE);
    promptExecution = new PromptExecutionEngine(this);
    generator = new AiImageGenerator(this);
    modelSelector = new ImageModelSelector(this);
    modelExecutor = new ImageModelExecutor(this);
    variations = new ImageVariationGenerator(this);
    enhancement = new ImageEnhancementEngine(this);
    background = new BackgroundGenerationEngine(this);
    placement = new ProductPlacementEngine(this);
    composition = new CompositionGenerator(this);
    style = new StyleGenerator(this);
    colour = new ColourHarmonyEngine(this);
    brand = new BrandStyleEngine(this);
    quality = new QualityChecker(this);
    safety = new SafetyValidator(this);
    cache = new ImageCacheManager(this);
    history = new GenerationHistoryManager(this);
    metadata = new ImageMetadataManager(this);
    async initialize(storageRoot, dependencies) {
        this.root = path.join(storageRoot, "image-generation-runtime");
        this.core = dependencies.core;
        this.models = dependencies.models;
        this.workspace = dependencies.workspace;
        this.planning = dependencies.planning;
        await fs.mkdir(path.join(this.root, "assets"), { recursive: true });
        this.store = await this.readStore();
        this.store.logs.unshift({ at: new Date().toISOString(), level: "info", message: "Image generation runtime restored." });
        await this.persist();
    }
    isInitialized() { return Boolean(this.root); }
    async generate(request) {
        this.ensureReady();
        this.safety.validate(request);
        const prepared = await this.promptExecution.prepare(request);
        const key = this.cache.key(prepared);
        const cachedIds = this.store.cache[key];
        if (cachedIds?.length) {
            const cached = cachedIds.map((id) => this.store.images.find((image) => image.id === id)).filter((image) => Boolean(image));
            if (cached.length === request.count)
                return cached.map((image) => ({ ...image, cached: true }));
        }
        const model = await this.modelSelector.select(prepared.modelId);
        await this.modelExecutor.load(model.id);
        const images = await this.variations.create(prepared, model.id);
        this.store.cache[key] = images.map((image) => image.id);
        this.history.record("generation", `Generated ${images.length} ${prepared.mode} image variation(s).`, images.map((image) => image.id));
        this.log("info", `Generated ${images.length} image variation(s) with ${model.name}.`);
        await this.persist();
        return images;
    }
    async getDashboard(projectId) { this.ensureReady(); const images = this.store.images.filter((image) => !projectId || image.projectId === projectId); return { images: images.map((image) => ({ ...image })), history: [...this.store.history], logs: [...this.store.logs], models: this.models.list().filter((model) => model.category === "image" && model.status !== "removed"), integrations: { aiCore: Boolean(this.core), modelManagement: Boolean(this.models), imageGenerationFoundation: Boolean(this.core?.imageGenerationFoundation), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), productIntelligence: Boolean(this.core?.productIntelligenceFoundation), imageIntelligence: Boolean(this.core?.imageIntelligenceFoundation), stateManager: Boolean(this.core?.stateManager), moduleManager: Boolean(this.core?.moduleManager), creativePipeline: Boolean(this.core?.workflowEngine) }, statistics: { generated: this.store.images.length, cachedRequests: Object.keys(this.store.cache).length, averageQuality: this.store.images.length ? Math.round(this.store.images.reduce((total, image) => total + image.quality.score, 0) / this.store.images.length) : 0 } }; }
    async getAssetPath(imageId) { const image = this.store.images.find((item) => item.id === imageId); if (!image)
        return null; const target = path.join(this.root, "assets", image.fileName); try {
        await fs.access(target);
        return target;
    }
    catch {
        return null;
    } }
    async defaultRequest(projectId) { const project = await this.workspace.getProject(projectId); const plan = await this.planning.getPlan(projectId); if (!project)
        throw new Error("Project not found"); return { projectId, prompt: plan?.prompts.image ?? `${project.productInformation.name}, ${project.productInformation.description}`, mode: project.productImages.length ? "product-to-image" : "text-to-image", style: "studio", aspectRatio: "1:1", resolution: "high", count: 1, productImageId: project.productImages[0]?.id }; }
    async render(request, modelId, variation) {
        const project = request.projectId ? await this.workspace.getProject(request.projectId) : null;
        const product = project?.productInformation;
        const selected = project?.productImages.find((image) => image.id === request.productImageId) ?? project?.productImages[0];
        const sourceImageUrl = selected ? `/api/workspace/projects/${project.id}/images/${encodeURIComponent(selected.fileName)}` : undefined;
        const id = randomUUID();
        const fileName = `${id}.svg`;
        const svg = this.generator.compose({ request, variation, brand: project?.brandInformation.name ?? "KWIZERA", productName: product?.name ?? "Creative concept", productDescription: product?.description ?? "", sourceImageUrl });
        await fs.writeFile(path.join(this.root, "assets", fileName), svg, "utf8");
        const quality = this.quality.score(request, Boolean(sourceImageUrl));
        const image = { id, projectId: request.projectId, name: `${product?.name ?? "Creative"} ${request.mode} ${variation + 1}`, fileName, mimeType: "image/svg+xml", mode: request.mode, modelId, prompt: request.prompt, style: request.style, aspectRatio: request.aspectRatio, resolution: request.resolution, createdAt: new Date().toISOString(), sourceImageUrl, quality, metadata: this.metadata.create(request, variation), cached: false };
        this.store.images.unshift(image);
        return { ...image };
    }
    log(level, message) { this.store.logs.unshift({ at: new Date().toISOString(), level, message }); this.store.logs.splice(100); this.core?.logger.info("image-generation", message); }
    async persist() { await fs.writeFile(path.join(this.root, "generation.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); }
    async readStore() { try {
        const value = JSON.parse(await fs.readFile(path.join(this.root, "generation.json"), "utf8"));
        return { ...structuredClone(EMPTY_STORE), ...value, images: value.images ?? [], history: value.history ?? [], cache: value.cache ?? {}, logs: value.logs ?? [] };
    }
    catch (error) {
        if (error.code === "ENOENT")
            return structuredClone(EMPTY_STORE);
        throw error;
    } }
    ensureReady() { if (!this.root || !this.models || !this.workspace || !this.planning)
        throw new Error("Image Generation Manager is not initialized"); }
}
export class PromptExecutionEngine {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async prepare(request) { const base = request.projectId ? await this.manager.defaultRequest(request.projectId) : {}; return { ...base, ...request, prompt: request.prompt.trim() }; }
}
export class ImageModelSelector {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async select(requested) { let model = requested ? this.manager["models"].getMutable(requested) : await this.manager["models"].selectBest("image"); if (!model) {
        await this.manager["models"].installer.install("studio-image-base");
        model = this.manager["models"].getMutable("studio-image-base");
    } if (model.category !== "image")
        throw new Error("Selected model does not support image generation"); return model; }
}
export class ImageModelExecutor {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async load(modelId) { const model = this.manager["models"].getMutable(modelId); if (model.status !== "loaded")
        await this.manager["models"].loader.load(modelId); }
}
export class ImageVariationGenerator {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async create(request, modelId) { return Promise.all(Array.from({ length: request.count }, (_, variation) => this.manager.render(request, modelId, variation))); }
}
export class AiImageGenerator {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    compose(input) { const [base, accent, text] = STYLE_PALETTES[input.request.style]; const [width, height] = dimensions(input.request.aspectRatio, input.request.resolution); const quote = xml(input.request.prompt); const shift = 80 + input.variation * 28; const product = input.sourceImageUrl ? `<image href="${xml(input.sourceImageUrl)}" x="${Math.round(width * .47)}" y="${Math.round(height * .2)}" width="${Math.round(width * .42)}" height="${Math.round(height * .65)}" preserveAspectRatio="xMidYMid meet"/>` : `<circle cx="${Math.round(width * .7)}" cy="${Math.round(height * .5)}" r="${Math.round(width * .17)}" fill="${accent}" opacity=".8"/>`; return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${base}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="${shift}" y="${Math.round(height * .15)}" width="${Math.round(width * .03)}" height="${Math.round(height * .68)}" fill="${text}" opacity=".75"/><text x="${Math.round(width * .12)}" y="${Math.round(height * .2)}" fill="${text}" font-family="Arial, sans-serif" font-size="${Math.round(width * .045)}" font-weight="700">${xml(input.brand).toUpperCase()}</text><text x="${Math.round(width * .12)}" y="${Math.round(height * .42)}" fill="${text}" font-family="Arial, sans-serif" font-size="${Math.round(width * .085)}" font-weight="700">${xml(input.productName)}</text><text x="${Math.round(width * .12)}" y="${Math.round(height * .5)}" fill="${text}" font-family="Arial, sans-serif" font-size="${Math.round(width * .028)}">${xml(input.productDescription).slice(0, 90)}</text><text x="${Math.round(width * .12)}" y="${Math.round(height * .67)}" fill="${text}" font-family="Arial, sans-serif" font-size="${Math.round(width * .025)}" opacity=".86">${quote.slice(0, 130)}</text>${product}<text x="${Math.round(width * .12)}" y="${Math.round(height * .82)}" fill="${text}" font-family="Arial, sans-serif" font-size="${Math.round(width * .03)}" font-weight="700">DISCOVER MORE</text></svg>`; }
}
export class ImageEnhancementEngine {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class BackgroundGenerationEngine {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class ProductPlacementEngine {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class CompositionGenerator {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class StyleGenerator {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class ColourHarmonyEngine {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class BrandStyleEngine {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
}
export class QualityChecker {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    score(request, hasProduct) { return { score: Math.min(98, 78 + (hasProduct ? 10 : 0) + (request.resolution === "high" ? 6 : 0)), notes: [hasProduct ? "Product imagery is preserved in the composition." : "Text-led composition generated.", `Brand style and ${request.style} palette applied.`] }; }
}
export class SafetyValidator {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    validate(request) { if (!request.prompt || request.prompt.trim().length < 8)
        throw new Error("Provide a descriptive prompt of at least 8 characters"); if (!Number.isInteger(request.count) || request.count < 1 || request.count > 6)
        throw new Error("Image count must be between 1 and 6"); if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(request.prompt))
        throw new Error("Prompt contains unsupported control characters"); }
}
export class ImageCacheManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    key(request) { return createHash("sha256").update(JSON.stringify({ ...request, count: undefined })).digest("hex"); }
}
export class GenerationHistoryManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    record(event, detail, imageIds) { this.manager["store"].history.unshift({ id: randomUUID(), at: new Date().toISOString(), event, detail, imageIds }); }
}
export class ImageMetadataManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    create(request, variation) { return { variation: variation + 1, promptLength: request.prompt.length, provider: "local-marketing-composer", generatedAt: new Date().toISOString() }; }
}
function dimensions(ratio, resolution) { const scale = resolution === "high" ? 2 : 1; return ratio === "16:9" ? [1280 * scale, 720 * scale] : ratio === "9:16" ? [720 * scale, 1280 * scale] : ratio === "4:5" ? [864 * scale, 1080 * scale] : [1080 * scale, 1080 * scale]; }
function xml(value) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;"); }
//# sourceMappingURL=image-generation-manager.js.map
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativePlanningManager } from "../creative-planning/creative-planning-manager.js";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { AiModelManager } from "../model-management/ai-model-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { MarketingIntelligenceManager } from "../marketing-intelligence/marketing-intelligence-manager.js";
import type { DecisionIntelligenceManager } from "../decision-intelligence/decision-intelligence-manager.js";
import type { AiLearningManager } from "../learning-intelligence/learning-intelligence-manager.js";
import type { GeneratedImage, ImageGenerationRequest, ImageGenerationStore, ImageStyle } from "./types.js";

const EMPTY_STORE: ImageGenerationStore = { images: [], history: [], cache: {}, logs: [] };
const STYLE_PALETTES: Record<ImageStyle, [string, string, string]> = { studio: ["#0d1b2a", "#1b4965", "#e0fbfc"], luxury: ["#14110f", "#8a6d3b", "#f7e7ce"], editorial: ["#17202a", "#c0392b", "#f7f9f9"], minimal: ["#f4f6f7", "#aeb6bf", "#1c2833"], bold: ["#111827", "#e11d48", "#fef08a"], lifestyle: ["#12343b", "#dca15d", "#f5ead7"] };

/** Executes safe, local marketing-image composition. A provider can replace the SVG renderer without changing this contract. */
export class ImageGenerationManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private models: AiModelManager | null = null;
  private workspace: CreativeWorkspaceManager | null = null;
  private planning: CreativePlanningManager | null = null;
  private productIntelligence: ProductIntelligenceManager | null = null;
  private imageIntelligence: ImageIntelligenceManager | null = null;
  private marketingIntelligence: MarketingIntelligenceManager | null = null;
  private decisionIntelligence: DecisionIntelligenceManager | null = null;
  private learningIntelligence: AiLearningManager | null = null;
  private store: ImageGenerationStore = structuredClone(EMPTY_STORE);
  readonly promptExecution = new PromptExecutionEngine(this);
  readonly generator = new AiImageGenerator(this);
  readonly modelSelector = new ImageModelSelector(this);
  readonly modelExecutor = new ImageModelExecutor(this);
  readonly variations = new ImageVariationGenerator(this);
  readonly enhancement = new ImageEnhancementEngine(this);
  readonly background = new BackgroundGenerationEngine(this);
  readonly placement = new ProductPlacementEngine(this);
  readonly composition = new CompositionGenerator(this);
  readonly style = new StyleGenerator(this);
  readonly colour = new ColourHarmonyEngine(this);
  readonly brand = new BrandStyleEngine(this);
  readonly quality = new QualityChecker(this);
  readonly safety = new SafetyValidator(this);
  readonly cache = new ImageCacheManager(this);
  readonly history = new GenerationHistoryManager(this);
  readonly metadata = new ImageMetadataManager(this);

  async initialize(storageRoot: string, dependencies: { core: AiCoreManager; models: AiModelManager; workspace: CreativeWorkspaceManager; planning: CreativePlanningManager }): Promise<void> {
    this.root = path.join(storageRoot, "image-generation-runtime"); this.core = dependencies.core; this.models = dependencies.models; this.workspace = dependencies.workspace; this.planning = dependencies.planning;
    await fs.mkdir(path.join(this.root, "assets"), { recursive: true }); this.store = await this.readStore();
    this.store.logs.unshift({ at: new Date().toISOString(), level: "info", message: "Image generation runtime restored." }); await this.persist();
  }
  isInitialized(): boolean { return Boolean(this.root); }
  attachProductIntelligence(manager: ProductIntelligenceManager): void { this.productIntelligence = manager; }
  attachImageIntelligence(manager: ImageIntelligenceManager): void { this.imageIntelligence = manager; }
  attachMarketingIntelligence(manager: MarketingIntelligenceManager): void { this.marketingIntelligence = manager; }
  attachDecisionIntelligence(manager: DecisionIntelligenceManager): void { this.decisionIntelligence = manager; }
  attachLearningIntelligence(manager: AiLearningManager): void { this.learningIntelligence = manager; }
  async generate(request: ImageGenerationRequest): Promise<GeneratedImage[]> {
    await this.decisionIntelligence?.decide(request.projectId, "image-generation");
    this.ensureReady(); this.safety.validate(request); const prepared = await this.promptExecution.prepare(request); const key = this.cache.key(prepared);
    const cachedIds = this.store.cache[key]; if (cachedIds?.length) { const cached = cachedIds.map((id) => this.store.images.find((image) => image.id === id)).filter((image): image is GeneratedImage => Boolean(image)); if (cached.length === request.count) return cached.map((image) => ({ ...image, cached: true })); }
    const model = await this.modelSelector.select(prepared.modelId); await this.modelExecutor.load(model.id);
    const images = await this.variations.create(prepared, model.id); this.store.cache[key] = images.map((image) => image.id); this.history.record("generation", `Generated ${images.length} ${prepared.mode} image variation(s).`, images.map((image) => image.id)); this.log("info", `Generated ${images.length} image variation(s) with ${model.name}.`); await this.persist(); await this.learningIntelligence?.learnFromProject(request.projectId, "success", `Image generation completed: ${images.length} ${prepared.mode} variation(s), average local quality ${Math.round(images.reduce((sum, image) => sum + image.quality.score, 0) / images.length)}/100.`).catch((error) => this.log("warning", `Learning collection deferred: ${error instanceof Error ? error.message : String(error)}`)); return images;
  }
  async getDashboard(projectId?: string): Promise<{ images: GeneratedImage[]; history: ImageGenerationStore["history"]; logs: ImageGenerationStore["logs"]; models: ReturnType<AiModelManager["list"]>; integrations: Record<string, boolean>; statistics: Record<string, number> }> { this.ensureReady(); const images = this.store.images.filter((image) => !projectId || image.projectId === projectId); return { images: images.map((image) => ({ ...image })), history: [...this.store.history], logs: [...this.store.logs], models: this.models!.list().filter((model) => model.category === "image" && model.status !== "removed"), integrations: { aiCore: Boolean(this.core), modelManagement: Boolean(this.models), imageGenerationFoundation: Boolean(this.core?.imageGenerationFoundation), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), productIntelligence: Boolean(this.core?.productIntelligenceFoundation), imageIntelligence: Boolean(this.core?.imageIntelligenceFoundation), stateManager: Boolean(this.core?.stateManager), moduleManager: Boolean(this.core?.moduleManager), creativePipeline: Boolean(this.core?.workflowEngine) }, statistics: { generated: this.store.images.length, cachedRequests: Object.keys(this.store.cache).length, averageQuality: this.store.images.length ? Math.round(this.store.images.reduce((total, image) => total + image.quality.score, 0) / this.store.images.length) : 0 } }; }
  async getAssetPath(imageId: string): Promise<string | null> { const image = this.store.images.find((item) => item.id === imageId); if (!image) return null; const target = path.join(this.root, "assets", image.fileName); try { await fs.access(target); return target; } catch { return null; } }
  async defaultRequest(projectId: string): Promise<Partial<ImageGenerationRequest>> { const project = await this.workspace!.getProject(projectId); const plan = await this.planning!.getPlan(projectId); const profile = await this.productIntelligence?.getProfile(projectId); const imageProfile = (await this.imageIntelligence?.getProfiles(projectId))?.[0]; const marketing = await this.marketingIntelligence?.getProfile(projectId); if (!project) throw new Error("Project not found"); return { projectId, prompt: plan?.prompts.image ?? `${project.productInformation.name}, ${project.productInformation.description}${profile ? `, ${profile.category}, ${profile.materials.join(" ")}, ${profile.colours.join(" ")}` : ""}${imageProfile ? `, ${imageProfile.composition}` : ""}${marketing ? `, ${marketing.valueProposition}, CTA: ${marketing.ctas[0]}` : ""}`, mode: project.productImages.length ? "product-to-image" : "text-to-image", style: "studio", aspectRatio: "1:1", resolution: "high", count: 1, productImageId: project.productImages[0]?.id }; }
  async render(request: ImageGenerationRequest, modelId: string, variation: number): Promise<GeneratedImage> {
    const project = request.projectId ? await this.workspace!.getProject(request.projectId) : null; const product = project?.productInformation; const selected = project?.productImages.find((image) => image.id === request.productImageId) ?? project?.productImages[0]; const sourceImageUrl = selected ? `/api/workspace/projects/${project!.id}/images/${encodeURIComponent(selected.fileName)}` : undefined;
    const id = randomUUID(); const fileName = `${id}.svg`; const svg = this.generator.compose({ request, variation, brand: project?.brandInformation.name ?? "KWIZERA", productName: product?.name ?? "Creative concept", productDescription: product?.description ?? "", sourceImageUrl }); await fs.writeFile(path.join(this.root, "assets", fileName), svg, "utf8");
    const quality = this.quality.score(request, Boolean(sourceImageUrl)); const image: GeneratedImage = { id, projectId: request.projectId, name: `${product?.name ?? "Creative"} ${request.mode} ${variation + 1}`, fileName, mimeType: "image/svg+xml", mode: request.mode, modelId, prompt: request.prompt, style: request.style, aspectRatio: request.aspectRatio, resolution: request.resolution, createdAt: new Date().toISOString(), sourceImageUrl, quality, metadata: this.metadata.create(request, variation), cached: false }; this.store.images.unshift(image); return { ...image };
  }
  log(level: "info" | "warning" | "error", message: string): void { this.store.logs.unshift({ at: new Date().toISOString(), level, message }); this.store.logs.splice(100); this.core?.logger.info("image-generation", message); }
  async persist(): Promise<void> { await fs.writeFile(path.join(this.root, "generation.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); }
  private async readStore(): Promise<ImageGenerationStore> { try { const value = JSON.parse(await fs.readFile(path.join(this.root, "generation.json"), "utf8")) as Partial<ImageGenerationStore>; return { ...structuredClone(EMPTY_STORE), ...value, images: value.images ?? [], history: value.history ?? [], cache: value.cache ?? {}, logs: value.logs ?? [] }; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_STORE); throw error; } }
  private ensureReady(): void { if (!this.root || !this.models || !this.workspace || !this.planning) throw new Error("Image Generation Manager is not initialized"); }
}

export class PromptExecutionEngine { constructor(private readonly manager: ImageGenerationManager) {} async prepare(request: ImageGenerationRequest): Promise<ImageGenerationRequest> { const base = request.projectId ? await this.manager.defaultRequest(request.projectId) : {}; return { ...base, ...request, prompt: request.prompt.trim() }; } }
export class ImageModelSelector { constructor(private readonly manager: ImageGenerationManager) {} async select(requested?: string) { let model = requested ? this.manager["models"]!.getMutable(requested) : await this.manager["models"]!.selectBest("image"); if (!model) { await this.manager["models"]!.installer.install("studio-image-base"); model = this.manager["models"]!.getMutable("studio-image-base"); } if (model.category !== "image") throw new Error("Selected model does not support image generation"); return model; } }
export class ImageModelExecutor { constructor(private readonly manager: ImageGenerationManager) {} async load(modelId: string): Promise<void> { const model = this.manager["models"]!.getMutable(modelId); if (model.status !== "loaded") await this.manager["models"]!.loader.load(modelId); } }
export class ImageVariationGenerator { constructor(private readonly manager: ImageGenerationManager) {} async create(request: ImageGenerationRequest, modelId: string): Promise<GeneratedImage[]> { return Promise.all(Array.from({ length: request.count }, (_, variation) => this.manager.render(request, modelId, variation))); } }
export class AiImageGenerator { constructor(private readonly manager: ImageGenerationManager) {} compose(input: { request: ImageGenerationRequest; variation: number; brand: string; productName: string; productDescription: string; sourceImageUrl?: string }): string { const [base, accent, text] = STYLE_PALETTES[input.request.style]; const [width, height] = dimensions(input.request.aspectRatio, input.request.resolution); const quote = xml(input.request.prompt); const shift = 80 + input.variation * 28; const product = input.sourceImageUrl ? `<image href="${xml(input.sourceImageUrl)}" x="${Math.round(width * .47)}" y="${Math.round(height * .2)}" width="${Math.round(width * .42)}" height="${Math.round(height * .65)}" preserveAspectRatio="xMidYMid meet"/>` : `<circle cx="${Math.round(width * .7)}" cy="${Math.round(height * .5)}" r="${Math.round(width * .17)}" fill="${accent}" opacity=".8"/>`; return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${base}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="${shift}" y="${Math.round(height * .15)}" width="${Math.round(width * .03)}" height="${Math.round(height * .68)}" fill="${text}" opacity=".75"/><text x="${Math.round(width * .12)}" y="${Math.round(height * .2)}" fill="${text}" font-family="Arial, sans-serif" font-size="${Math.round(width * .045)}" font-weight="700">${xml(input.brand).toUpperCase()}</text><text x="${Math.round(width * .12)}" y="${Math.round(height * .42)}" fill="${text}" font-family="Arial, sans-serif" font-size="${Math.round(width * .085)}" font-weight="700">${xml(input.productName)}</text><text x="${Math.round(width * .12)}" y="${Math.round(height * .5)}" fill="${text}" font-family="Arial, sans-serif" font-size="${Math.round(width * .028)}">${xml(input.productDescription).slice(0, 90)}</text><text x="${Math.round(width * .12)}" y="${Math.round(height * .67)}" fill="${text}" font-family="Arial, sans-serif" font-size="${Math.round(width * .025)}" opacity=".86">${quote.slice(0, 130)}</text>${product}<text x="${Math.round(width * .12)}" y="${Math.round(height * .82)}" fill="${text}" font-family="Arial, sans-serif" font-size="${Math.round(width * .03)}" font-weight="700">DISCOVER MORE</text></svg>`; } }
export class ImageEnhancementEngine { constructor(private readonly manager: ImageGenerationManager) {} }
export class BackgroundGenerationEngine { constructor(private readonly manager: ImageGenerationManager) {} }
export class ProductPlacementEngine { constructor(private readonly manager: ImageGenerationManager) {} }
export class CompositionGenerator { constructor(private readonly manager: ImageGenerationManager) {} }
export class StyleGenerator { constructor(private readonly manager: ImageGenerationManager) {} }
export class ColourHarmonyEngine { constructor(private readonly manager: ImageGenerationManager) {} }
export class BrandStyleEngine { constructor(private readonly manager: ImageGenerationManager) {} }
export class QualityChecker { constructor(private readonly manager: ImageGenerationManager) {} score(request: ImageGenerationRequest, hasProduct: boolean) { return { score: Math.min(98, 78 + (hasProduct ? 10 : 0) + (request.resolution === "high" ? 6 : 0)), notes: [hasProduct ? "Product imagery is preserved in the composition." : "Text-led composition generated.", `Brand style and ${request.style} palette applied.`] }; } }
export class SafetyValidator { constructor(private readonly manager: ImageGenerationManager) {} validate(request: ImageGenerationRequest): void { if (!request.prompt || request.prompt.trim().length < 8) throw new Error("Provide a descriptive prompt of at least 8 characters"); if (!Number.isInteger(request.count) || request.count < 1 || request.count > 6) throw new Error("Image count must be between 1 and 6"); if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(request.prompt)) throw new Error("Prompt contains unsupported control characters"); } }
export class ImageCacheManager { constructor(private readonly manager: ImageGenerationManager) {} key(request: ImageGenerationRequest): string { return createHash("sha256").update(JSON.stringify({ ...request, count: undefined })).digest("hex"); } }
export class GenerationHistoryManager { constructor(private readonly manager: ImageGenerationManager) {} record(event: string, detail: string, imageIds: string[]): void { this.manager["store"].history.unshift({ id: randomUUID(), at: new Date().toISOString(), event, detail, imageIds }); } }
export class ImageMetadataManager { constructor(private readonly manager: ImageGenerationManager) {} create(request: ImageGenerationRequest, variation: number): Record<string, string | number> { return { variation: variation + 1, promptLength: request.prompt.length, provider: "local-marketing-composer", generatedAt: new Date().toISOString() }; } }
function dimensions(ratio: ImageGenerationRequest["aspectRatio"], resolution: ImageGenerationRequest["resolution"]): [number, number] { const scale = resolution === "high" ? 2 : 1; return ratio === "16:9" ? [1280 * scale, 720 * scale] : ratio === "9:16" ? [720 * scale, 1280 * scale] : ratio === "4:5" ? [864 * scale, 1080 * scale] : [1080 * scale, 1080 * scale]; }
function xml(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;"); }
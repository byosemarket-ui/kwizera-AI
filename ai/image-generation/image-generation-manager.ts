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

/** Executes provider-backed local image inference and persists verified binary marketing assets. */
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
    if (request.projectId) await this.decisionIntelligence?.decide(request.projectId, "image-generation");
    this.ensureReady(); this.safety.validate(request); const prepared = await this.promptExecution.prepare(request); const key = this.cache.key(prepared);
    const cachedIds = this.store.cache[key]; if (cachedIds?.length) { const cached = cachedIds.map((id) => this.store.images.find((image) => image.id === id)).filter((image): image is GeneratedImage => Boolean(image)); if (cached.length === request.count) return cached.map((image) => ({ ...image, cached: true })); }
    const model = await this.modelSelector.select(prepared.modelId); await this.modelExecutor.load(model.id);
    const images = await this.variations.create(prepared, model.id); this.store.cache[key] = images.map((image) => image.id); this.history.record("generation", `Generated ${images.length} ${prepared.mode} image variation(s).`, images.map((image) => image.id)); this.log("info", `Generated ${images.length} image variation(s) with ${model.name}.`); await this.persist(); if (request.projectId) await this.learningIntelligence?.learnFromProject(request.projectId, "success", `Image generation completed: ${images.length} ${prepared.mode} variation(s), average local quality ${Math.round(images.reduce((sum, image) => sum + image.quality.score, 0) / images.length)}/100.`).catch((error) => this.log("warning", `Learning collection deferred: ${error instanceof Error ? error.message : String(error)}`)); return images;
  }
  async getDashboard(projectId?: string): Promise<{ images: GeneratedImage[]; history: ImageGenerationStore["history"]; logs: ImageGenerationStore["logs"]; models: ReturnType<AiModelManager["list"]>; integrations: Record<string, boolean>; statistics: Record<string, number> }> { this.ensureReady(); const images = this.store.images.filter((image) => !projectId || image.projectId === projectId); return { images: images.map((image) => ({ ...image })), history: [...this.store.history], logs: [...this.store.logs], models: this.models!.list().filter((model) => model.category === "image" && model.status !== "removed"), integrations: { aiCore: Boolean(this.core), modelManagement: Boolean(this.models), imageGenerationFoundation: Boolean(this.core?.imageGenerationFoundation), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), productIntelligence: Boolean(this.core?.productIntelligenceFoundation), imageIntelligence: Boolean(this.core?.imageIntelligenceFoundation), stateManager: Boolean(this.core?.stateManager), moduleManager: Boolean(this.core?.moduleManager), creativePipeline: Boolean(this.core?.workflowEngine) }, statistics: { generated: this.store.images.length, cachedRequests: Object.keys(this.store.cache).length, averageQuality: this.store.images.length ? Math.round(this.store.images.reduce((total, image) => total + image.quality.score, 0) / this.store.images.length) : 0 } }; }
  async getAssetPath(imageId: string): Promise<string | null> { const image = this.store.images.find((item) => item.id === imageId); if (!image) return null; const target = path.join(this.root, "assets", image.fileName); try { await fs.access(target); return target; } catch { return null; } }
  async defaultRequest(projectId: string): Promise<Partial<ImageGenerationRequest>> { const [project, plan, profile, imageProfiles, marketing] = await Promise.all([this.workspace!.getProject(projectId), this.planning!.getPlan(projectId), this.productIntelligence?.getProfile(projectId), this.imageIntelligence?.getProfiles(projectId), this.marketingIntelligence?.getProfile(projectId)]); const imageProfile = imageProfiles?.[0]; if (!project) throw new Error("Project not found"); return { projectId, prompt: plan?.prompts.image ?? `${project.productInformation.name}, ${project.productInformation.description}${profile ? `, ${profile.category}, ${profile.materials.join(" ")}, ${profile.colours.join(" ")}` : ""}${imageProfile ? `, ${imageProfile.composition}` : ""}${marketing ? `, ${marketing.valueProposition}, CTA: ${marketing.ctas[0]}` : ""}`, mode: project.productImages.length ? "product-to-image" : "text-to-image", style: "studio", aspectRatio: "1:1", resolution: "high", count: 1, productImageId: project.productImages[0]?.id }; }
  async render(request: ImageGenerationRequest, modelId: string, variation: number): Promise<GeneratedImage> {
    const project = request.projectId ? await this.workspace!.getProject(request.projectId) : null; const product = project?.productInformation; const selected = project?.productImages.find((image) => image.id === request.productImageId) ?? project?.productImages[0]; const sourceImageUrl = selected ? `/api/workspace/projects/${project!.id}/images/${encodeURIComponent(selected.fileName)}` : undefined;
    const imageToImageMode = request.mode === "product-to-image" || request.mode === "image-editing" || request.mode === "image-restoration" || request.mode === "photo-enhancement" || request.mode === "background-replacement";
    if (imageToImageMode && (!selected || !project)) throw new Error(`${request.mode} requires a selected local product image`);
    const sourceImageBase64 = selected && project ? await this.readSourceImage(project.id, selected.url) : undefined;
    const [width, height] = dimensions(request.aspectRatio, request.resolution);
    const result = await this.models!.inference.generateImage({ modelId, prompt: request.prompt, negativePrompt: negativePrompt(request), width, height, batchSize: 1, seed: request.seed === undefined ? undefined : request.seed + variation, sourceImageBase64: imageToImageMode ? sourceImageBase64 : undefined, strength: imageToImageMode ? .55 : undefined });
    const output = result.images[0]; if (!output) throw new Error("Local image provider returned an empty image batch");
    const id = randomUUID(); const extension = output.mimeType.split("/")[1].replace("jpeg", "jpg"); const fileName = `${id}.${extension}`; await fs.writeFile(path.join(this.root, "assets", fileName), output.bytes);
    const quality = this.quality.score(request, Boolean(sourceImageUrl), output.bytes.byteLength, output.width, output.height); const image: GeneratedImage = { id, projectId: request.projectId, name: `${product?.name ?? "Creative"} ${request.mode} ${variation + 1}`, fileName, mimeType: output.mimeType, mode: request.mode, modelId, prompt: request.prompt, style: request.style, aspectRatio: request.aspectRatio, resolution: request.resolution, createdAt: new Date().toISOString(), sourceImageUrl, quality, metadata: this.metadata.create(request, variation, result.providerId, result.backend, result.durationMs, output.width, output.height), cached: false }; this.store.images.unshift(image); return { ...image };
  }
  log(level: "info" | "warning" | "error", message: string): void { this.store.logs.unshift({ at: new Date().toISOString(), level, message }); this.store.logs.splice(100); this.core?.logger.info("generation", message); }
  async persist(): Promise<void> { await fs.writeFile(path.join(this.root, "generation.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); }
  private async readStore(): Promise<ImageGenerationStore> { try { const value = JSON.parse(await fs.readFile(path.join(this.root, "generation.json"), "utf8")) as Partial<ImageGenerationStore>; return { ...structuredClone(EMPTY_STORE), ...value, images: value.images ?? [], history: value.history ?? [], cache: value.cache ?? {}, logs: value.logs ?? [] }; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_STORE); throw error; } }
  async constructPrompt(request: ImageGenerationRequest): Promise<string> { const project = request.projectId ? await this.workspace!.getProject(request.projectId) : null; const [product, imageProfiles, marketing] = await Promise.all([request.projectId ? this.productIntelligence?.analyze(request.projectId) : undefined, request.projectId ? this.imageIntelligence?.analyzeProject(request.projectId) : undefined, request.projectId ? this.marketingIntelligence?.analyze(request.projectId) : undefined]); const details = [project?.productInformation.name, project?.productInformation.description, product?.materials.join(", "), product?.colours.join(", "), imageProfiles?.[0]?.composition, marketing?.valueProposition, marketing?.campaign.objective, request.scene?.replace(/-/g, " "), request.background ? `${request.background} background` : "", request.lighting ? `${request.lighting} lighting` : "", request.shadow ? `${request.shadow} shadow` : "", request.reflection ? `${request.reflection} reflection` : "", `${request.style} professional marketing photography`, project?.brandInformation.guidelines, request.prompt].filter((value): value is string => Boolean(value && !value.includes("requires visual-provider verification"))); return uniquePrompt(details).join(", "); }
  private async readSourceImage(projectId: string, sourceUrl: string): Promise<string> { const storedName = path.basename(sourceUrl); const sourcePath = await this.workspace!.getImagePath(projectId, storedName); if (!sourcePath) throw new Error("Selected product image is unavailable in the local workspace"); const bytes = await fs.readFile(sourcePath); if (!bytes.length || bytes.length > 15 * 1024 * 1024) throw new Error("Selected product image is invalid for local inference"); return bytes.toString("base64"); }
  private ensureReady(): void { if (!this.root || !this.models || !this.workspace || !this.planning) throw new Error("Image Generation Manager is not initialized"); }
}

export class PromptExecutionEngine { constructor(private readonly manager: ImageGenerationManager) {} async prepare(request: ImageGenerationRequest): Promise<ImageGenerationRequest> { const base = request.projectId ? await this.manager.defaultRequest(request.projectId) : {}; const merged = { ...base, ...request, prompt: request.prompt.trim() } as ImageGenerationRequest; return { ...merged, prompt: await this.manager.constructPrompt(merged) }; } }
export class ImageModelSelector { constructor(private readonly manager: ImageGenerationManager) {} async select(requested?: string) { let model = requested ? this.manager["models"]!.getMutable(requested) : await this.manager["models"]!.selectBest("image"); if (!model) { await this.manager["models"]!.installer.install("studio-image-base"); model = this.manager["models"]!.getMutable("studio-image-base"); } if (model.category !== "image") throw new Error("Selected model does not support image generation"); return model; } }
export class ImageModelExecutor { constructor(private readonly manager: ImageGenerationManager) {} async load(modelId: string): Promise<void> { await this.manager["models"]!.preparePreview(modelId); } }
export class ImageVariationGenerator { constructor(private readonly manager: ImageGenerationManager) {} async create(request: ImageGenerationRequest, modelId: string): Promise<GeneratedImage[]> { return Promise.all(Array.from({ length: request.count }, (_, variation) => this.manager.render(request, modelId, variation))); } }
export class ImageEnhancementEngine { constructor(private readonly manager: ImageGenerationManager) {} }
export class BackgroundGenerationEngine { constructor(private readonly manager: ImageGenerationManager) {} }
export class ProductPlacementEngine { constructor(private readonly manager: ImageGenerationManager) {} }
export class CompositionGenerator { constructor(private readonly manager: ImageGenerationManager) {} }
export class StyleGenerator { constructor(private readonly manager: ImageGenerationManager) {} }
export class ColourHarmonyEngine { constructor(private readonly manager: ImageGenerationManager) {} }
export class BrandStyleEngine { constructor(private readonly manager: ImageGenerationManager) {} }
export class QualityChecker { constructor(private readonly manager: ImageGenerationManager) {} score(request: ImageGenerationRequest, hasProduct: boolean, sizeBytes: number, width?: number, height?: number) { if (!sizeBytes) throw new Error("Generated image did not contain binary data"); const expected = dimensions(request.aspectRatio, request.resolution); const dimensionsMatch = !width || !height || (width === expected[0] && height === expected[1]); if (!dimensionsMatch) throw new Error(`Generated image dimensions ${width}x${height} do not match requested ${expected[0]}x${expected[1]}`); return { score: Math.min(98, 72 + (hasProduct ? 10 : 0) + (request.resolution === "high" ? 8 : 0) + (sizeBytes > 10_000 ? 6 : 0)), notes: [hasProduct ? "Product reference was supplied to the local image model." : "Text-to-image inference completed by a local model.", `Verified ${sizeBytes} byte binary asset with ${request.style} brand direction.`] }; } }
export class SafetyValidator { constructor(private readonly manager: ImageGenerationManager) {} validate(request: ImageGenerationRequest): void { if (!request.prompt || request.prompt.trim().length < 8) throw new Error("Provide a descriptive prompt of at least 8 characters"); if (!Number.isInteger(request.count) || request.count < 1 || request.count > 6) throw new Error("Image count must be between 1 and 6"); if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(request.prompt)) throw new Error("Prompt contains unsupported control characters"); } }
export class ImageCacheManager { constructor(private readonly manager: ImageGenerationManager) {} key(request: ImageGenerationRequest): string { return createHash("sha256").update(JSON.stringify({ ...request, count: undefined })).digest("hex"); } }
export class GenerationHistoryManager { constructor(private readonly manager: ImageGenerationManager) {} record(event: string, detail: string, imageIds: string[]): void { this.manager["store"].history.unshift({ id: randomUUID(), at: new Date().toISOString(), event, detail, imageIds }); } }
export class ImageMetadataManager { constructor(private readonly manager: ImageGenerationManager) {} create(request: ImageGenerationRequest, variation: number, provider: string, backend: string, durationMs: number, width?: number, height?: number): Record<string, string | number> { return { variation: variation + 1, promptLength: request.prompt.length, provider, backend, durationMs, width: width ?? 0, height: height ?? 0, generatedAt: new Date().toISOString() }; } }
function dimensions(ratio: ImageGenerationRequest["aspectRatio"], resolution: ImageGenerationRequest["resolution"]): [number, number] { const scale = resolution === "high" ? 2 : 1; return ratio === "16:9" ? [1280 * scale, 720 * scale] : ratio === "9:16" ? [720 * scale, 1280 * scale] : ratio === "4:5" ? [864 * scale, 1080 * scale] : [1080 * scale, 1080 * scale]; }
function negativePrompt(request: ImageGenerationRequest): string { return ["text, watermark, logo distortion, duplicate product, malformed product geometry, blurry, low resolution", request.mode === "product-to-image" ? "changed product label, incorrect product proportions" : ""].filter(Boolean).join(", "); }
function uniquePrompt(parts: string[]): string[] { return [...new Set(parts.map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean))]; }
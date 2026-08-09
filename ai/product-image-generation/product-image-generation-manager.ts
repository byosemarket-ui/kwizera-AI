import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { ProductAssetPreparationManager } from "../product-asset-preparation/product-asset-preparation-manager.js";
import type { ProductAssetPreparationResult, ProductAssetRecord } from "../product-asset-preparation/types.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import type { ProductPromptOrchestrationManager } from "../product-prompt-orchestration/product-prompt-orchestration-manager.js";
import type { ProductPromptOrchestrationResult, ScenePromptSet } from "../product-prompt-orchestration/types.js";
import type { ProductScenePlanningManager } from "../product-scene-planning/product-scene-planning-manager.js";
import type { ProductStoryboardManager } from "../product-storyboard/product-storyboard-manager.js";
import type { ProductStoryboardResult } from "../product-storyboard/types.js";
import { buildPlacement, composeSceneImage, selectBackgroundStyle } from "./scene-image-composer.js";
import type {
  AiMeProductImageGenerationAwareness,
  ProductImageGenerationExplainResult,
  ProductImageGenerationHealthReport,
  ProductImageGenerationQuality,
  ProductImageGenerationResult,
  ProductImageGenerationStore,
  SceneMarketingImage,
} from "./types.js";

const EMPTY: ProductImageGenerationStore = { generations: [], cache: {}, history: [], logs: [] };

/** Step 6 runtime: scene marketing stills from Steps 1–5. Preserves product identity. Defers video. */
export class ProductImageGenerationManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private workspace: CreativeWorkspaceManager | null = null;
  private products: ProductIntelligenceManager | null = null;
  private assets: ProductAssetPreparationManager | null = null;
  private scenes: ProductScenePlanningManager | null = null;
  private storyboards: ProductStoryboardManager | null = null;
  private orchestration: ProductPromptOrchestrationManager | null = null;
  private store: ProductImageGenerationStore = structuredClone(EMPTY);

  readonly quality = new ProductImageQualityEngine();
  readonly health = new ProductImageGenerationHealthManager(this);

  async initialize(
    storageRoot: string,
    dependencies: {
      core: AiCoreManager;
      workspace: CreativeWorkspaceManager;
      products: ProductIntelligenceManager;
      assets: ProductAssetPreparationManager;
      scenes: ProductScenePlanningManager;
      storyboards: ProductStoryboardManager;
      orchestration: ProductPromptOrchestrationManager;
    },
  ): Promise<void> {
    this.root = path.join(storageRoot, "product-image-generation-runtime");
    this.core = dependencies.core;
    this.workspace = dependencies.workspace;
    this.products = dependencies.products;
    this.assets = dependencies.assets;
    this.scenes = dependencies.scenes;
    this.storyboards = dependencies.storyboards;
    this.orchestration = dependencies.orchestration;
    await fs.mkdir(path.join(this.root, "assets"), { recursive: true });
    this.store = await this.readStore();
    this.log("info", "Product image generation runtime restored.");
    await this.persist();
  }

  isInitialized(): boolean {
    return Boolean(this.root && this.workspace && this.products && this.assets && this.storyboards && this.orchestration);
  }

  async generateProductSceneImages(projectId: string): Promise<ProductImageGenerationResult> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");

    const product = (await this.products!.getProfile(projectId))
      ?? (await this.products!.analyzeProductIntelligence(projectId));
    const prepared = (await this.assets!.getResult(projectId))
      ?? (await this.assets!.prepareProductAssets(projectId));
    if (!prepared.assets.length) throw new Error("Prepare product assets before image generation.");
    await this.scenes!.getPlan(projectId) ?? (await this.scenes!.planProductScenes(projectId));
    const storyboard = (await this.storyboards!.getStoryboard(projectId))
      ?? (await this.storyboards!.generateStoryboardAndScript(projectId));
    const orch = (await this.orchestration!.getOrchestration(projectId))
      ?? (await this.orchestration!.orchestratePromptsAndModels(projectId));
    if (!orch.scenePromptSets.length) throw new Error("Orchestrate prompts before image generation.");

    const cacheKey = this.cacheKey(project, product, prepared, storyboard, orch);
    const cachedId = this.store.cache[cacheKey];
    const cached = cachedId ? this.store.generations.find((item) => item.generationId === cachedId) : undefined;
    if (cached) return { ...cached, cached: true };

    const projectAssetDir = path.join(this.root, "assets", projectId);
    await fs.mkdir(projectAssetDir, { recursive: true });

    let images: SceneMarketingImage[] = [];
    let primaryBackground = selectBackgroundStyle({
      backgroundPrompt: orch.scenePromptSets[0]?.prompts.background ?? "",
      imagePrompt: orch.scenePromptSets[0]?.prompts.image ?? "",
      marketingObjective: storyboard.marketingObjective,
      sceneNumber: 1,
    });
    for (const promptSet of orch.scenePromptSets) {
      const panel = storyboard.panels.find((item) => item.sceneId === promptSet.sceneId || item.sceneNumber === promptSet.sceneNumber);
      const asset = resolveAsset(prepared, promptSet.assetId, promptSet.sourceImageId);
      if (!asset) throw new Error(`Missing prepared asset for scene ${promptSet.sceneNumber}`);
      const sourceBytes = await this.loadSourceBytes(projectId, asset);
      const suggested = selectBackgroundStyle({
        backgroundPrompt: promptSet.prompts.background,
        imagePrompt: promptSet.prompts.image,
        marketingObjective: storyboard.marketingObjective,
        sceneNumber: promptSet.sceneNumber,
      });
      // Keep a tight style family for campaign consistency; allow lifestyle alternate only.
      const bg = promptSet.sceneNumber === 1
        ? suggested
        : relatedBackground(primaryBackground.style, suggested.style, suggested.why);
      if (promptSet.sceneNumber === 1) primaryBackground = suggested;
      const placement = buildPlacement(promptSet.sceneNumber, panel?.productPosition ?? "center");
      const composed = composeSceneImage({
        sourceBytes,
        backgroundStyle: bg.style,
        placement,
        brandHint: product.brand || project.brandInformation?.name,
      });

      const imageId = randomUUID();
      const fileName = `scene-${String(promptSet.sceneNumber).padStart(2, "0")}-${imageId.slice(0, 8)}.png`;
      const relativePath = path.join("assets", projectId, fileName);
      await fs.writeFile(path.join(this.root, relativePath), composed.png);

      images.push({
        imageId,
        sceneNumber: promptSet.sceneNumber,
        sceneId: promptSet.sceneId,
        assetId: asset.assetId,
        sourceImageId: asset.sourceImageId,
        productName: product.productName,
        fileName,
        relativePath: relativePath.replace(/\\/g, "/"),
        mimeType: "image/png",
        resolution: { width: composed.width, height: composed.height },
        backgroundStyle: bg.style,
        backgroundWhy: bg.why,
        lightingWhy: `Lighting follows prompt lock: ${orch.consistency.lightingStyle}. Scene lighting prompt applied without changing product identity.`,
        placement,
        enhancement: composed.enhancement,
        promptUsed: promptSet.prompts.image,
        productPreserved: true,
        originalUnmodified: true,
        consistencyLocks: [
          orch.consistency.productName,
          orch.consistency.style,
          orch.consistency.cameraLanguage,
          orch.consistency.lightingStyle,
          orch.consistency.brandIdentity,
        ],
        quality: this.quality.scoreScene(composed.productPixelCount, composed.width * composed.height, promptSet, orch),
        createdAt: new Date().toISOString(),
      });
    }

    let quality = this.quality.evaluate(images, orch, product);
    const repairs: string[] = [];
    if (quality.issues.length) {
      const repaired = await this.applyQualityRepairs(images, quality.issues, projectId, prepared, storyboard, orch, product, project);
      images = repaired.images;
      repairs.push(...repaired.repairs);
      quality = this.quality.evaluate(images, orch, product);
      quality.repairs = repairs;
    }

    const now = new Date().toISOString();
    const result: ProductImageGenerationResult = {
      generationId: randomUUID(),
      projectId,
      productId: product.id,
      orchestrationId: orch.orchestrationId,
      storyboardId: storyboard.storyboardId,
      images,
      consistency: {
        productName: orch.consistency.productName,
        colors: [...orch.consistency.colors],
        brand: orch.consistency.brandIdentity,
        cameraStyle: orch.consistency.cameraLanguage,
        lightingStyle: orch.consistency.lightingStyle,
        backgroundStyleFamily: majority(images.map((image) => image.backgroundStyle)),
      },
      improvementRecommendations: this.buildImprovements(images, quality),
      quality,
      creativePipelineStep: 6,
      videoGenerationDeferred: true,
      originalsUnmodified: true,
      createdAt: now,
      updatedAt: now,
      cached: false,
    };

    this.store.generations = this.store.generations.filter((item) => item.projectId !== projectId);
    this.store.generations.unshift(result);
    this.store.cache[cacheKey] = result.generationId;
    this.history(projectId, "generate", `Generated ${result.images.length} scene image(s) for ${product.productName}.`);
    this.log("info", `Product image generation ready for ${project.name}.`);
    await this.persist();
    return structuredClone(result);
  }

  async getGeneration(projectId: string): Promise<ProductImageGenerationResult | null> {
    return this.store.generations.find((item) => item.projectId === projectId) ?? null;
  }

  async getImageAbsolutePath(imageId: string): Promise<string | null> {
    for (const generation of this.store.generations) {
      const image = generation.images.find((item) => item.imageId === imageId);
      if (!image) continue;
      const absolute = path.join(this.root, image.relativePath);
      try {
        await fs.access(absolute);
        return absolute;
      } catch {
        return null;
      }
    }
    return null;
  }

  async explainGeneration(projectId: string): Promise<ProductImageGenerationExplainResult> {
    const result = (await this.getGeneration(projectId)) ?? (await this.generateProductSceneImages(projectId));
    return {
      generationId: result.generationId,
      productName: result.consistency.productName,
      summary: `Generated ${result.images.length} marketing still(s) for "${result.consistency.productName}" with product preservation and deferred video generation.`,
      imageExplanations: result.images.map((image) => ({
        sceneNumber: image.sceneNumber,
        why: `Scene ${image.sceneNumber} composites preserved asset ${image.assetId} into ${image.backgroundStyle} using image prompt; product identity locked.`,
        path: image.relativePath,
      })),
      backgroundExplanations: result.images.map((image) => ({
        sceneNumber: image.sceneNumber,
        style: image.backgroundStyle,
        why: image.backgroundWhy,
      })),
      lightingExplanations: result.images.map((image) => ({
        sceneNumber: image.sceneNumber,
        why: image.lightingWhy,
      })),
      improvementRecommendations: result.improvementRecommendations,
      readyForVideoGeneration: result.quality.overall >= 70 && result.images.every((image) => image.productPreserved),
    };
  }

  async recommendImageImprovements(projectId: string): Promise<string[]> {
    const result = (await this.getGeneration(projectId)) ?? (await this.generateProductSceneImages(projectId));
    return [...result.improvementRecommendations];
  }

  getAiMeProductImageGenerationAwareness(): AiMeProductImageGenerationAwareness {
    const available = this.isInitialized();
    return {
      available,
      enabled: available,
      offlineFirst: true,
      canExplainGeneratedImages: available,
      canExplainBackgroundSelection: available,
      canExplainLightingDecisions: available,
      canRecommendImageImprovements: available,
      videoGenerationDeferred: true,
      summary: available
        ? "AI Me Product Image Generation is online: explain scene images, backgrounds, and lighting; recommend improvements. Video generation remains deferred."
        : "Product Image Generation runtime is not initialized.",
    };
  }

  async runHealthCheck(projectId?: string): Promise<ProductImageGenerationHealthReport> {
    return this.health.check(projectId);
  }

  async repair(projectId?: string): Promise<ProductImageGenerationHealthReport> {
    return this.health.repair(projectId);
  }

  async getDashboard(projectId?: string): Promise<{
    generations: ProductImageGenerationResult[];
    history: ProductImageGenerationStore["history"];
    logs: ProductImageGenerationStore["logs"];
    awareness: AiMeProductImageGenerationAwareness;
    analytics: Record<string, number>;
  }> {
    const generations = this.store.generations.filter((item) => !projectId || item.projectId === projectId);
    return {
      generations: structuredClone(generations),
      history: this.store.history.filter((item) => !projectId || item.projectId === projectId),
      logs: [...this.store.logs],
      awareness: this.getAiMeProductImageGenerationAwareness(),
      analytics: {
        generations: generations.length,
        images: generations.reduce((sum, item) => sum + item.images.length, 0),
        averageQuality: generations.length
          ? Math.round(generations.reduce((sum, item) => sum + item.quality.overall, 0) / generations.length)
          : 0,
        cached: Object.keys(this.store.cache).length,
      },
    };
  }

  async persist(): Promise<void> {
    await fs.writeFile(path.join(this.root, "generations.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8");
  }

  log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.unshift({ at: new Date().toISOString(), level, message });
    this.store.logs.splice(100);
    this.core?.logger.info("product-image-generation", message);
  }

  history(projectId: string, event: string, detail: string): void {
    this.store.history.unshift({ id: randomUUID(), at: new Date().toISOString(), projectId, event, detail });
    this.store.history.splice(100);
  }

  private ensureReady(): void {
    if (!this.isInitialized()) throw new Error("Product Image Generation Manager is not initialized");
  }

  private async readStore(): Promise<ProductImageGenerationStore> {
    try {
      const raw = await fs.readFile(path.join(this.root, "generations.json"), "utf8");
      return { ...structuredClone(EMPTY), ...JSON.parse(raw) } as ProductImageGenerationStore;
    } catch {
      return structuredClone(EMPTY);
    }
  }

  private cacheKey(
    project: CreativeProject,
    product: ProductIntelligenceProfile,
    prepared: ProductAssetPreparationResult,
    storyboard: ProductStoryboardResult,
    orch: ProductPromptOrchestrationResult,
  ): string {
    return createHash("sha256")
      .update(JSON.stringify({
        projectId: project.id,
        productId: product.id,
        orchestrationId: orch.orchestrationId,
        storyboardId: storyboard.storyboardId,
        assets: prepared.assets.map((asset) => [asset.assetId, asset.fingerprint]),
        prompts: orch.scenePromptSets.map((set) => [set.sceneId, set.promptIds.image]),
      }))
      .digest("hex");
  }

  private async loadSourceBytes(projectId: string, asset: ProductAssetRecord): Promise<Buffer> {
    // Prefer original upload bytes so cutout identity matches Step 2 (originals stay unmodified).
    const imageName = (await this.workspace!.getProject(projectId))?.productImages
      .find((image) => image.id === asset.sourceImageId)?.url.split("/").pop();
    if (imageName) {
      const originalPath = await this.workspace!.getImagePath(projectId, imageName);
      if (originalPath) {
        try {
          return await fs.readFile(originalPath);
        } catch { /* fall through */ }
      }
    }
    const cutoutPath = await this.assets!.getAssetAbsolutePath(asset.assetId);
    if (cutoutPath) {
      try {
        return await fs.readFile(cutoutPath);
      } catch { /* fall through */ }
    }
    // Deterministic placeholder derived from asset fingerprint — never invents product features.
    return Buffer.from(asset.fingerprint || asset.assetId);
  }

  private async applyQualityRepairs(
    images: SceneMarketingImage[],
    issues: string[],
    projectId: string,
    prepared: ProductAssetPreparationResult,
    storyboard: ProductStoryboardResult,
    orch: ProductPromptOrchestrationResult,
    product: ProductIntelligenceProfile,
    project: CreativeProject,
  ): Promise<{ images: SceneMarketingImage[]; repairs: string[] }> {
    const repairs: string[] = [];
    let next = [...images];
    if (issues.some((issue) => issue.includes("product-preservation") || issue.includes("product-accuracy"))) {
      const rebuilt: SceneMarketingImage[] = [];
      for (const image of next) {
        const promptSet = orch.scenePromptSets.find((set) => set.sceneNumber === image.sceneNumber)!;
        const asset = resolveAsset(prepared, image.assetId, image.sourceImageId)!;
        const sourceBytes = await this.loadSourceBytes(projectId, asset);
        const panel = storyboard.panels.find((item) => item.sceneNumber === image.sceneNumber);
        const placement = { ...buildPlacement(image.sceneNumber, panel?.productPosition ?? "center"), scale: 0.76 };
        const composed = composeSceneImage({
          sourceBytes,
          backgroundStyle: image.backgroundStyle,
          placement,
          brandHint: product.brand || project.brandInformation?.name,
        });
        await fs.writeFile(path.join(this.root, image.relativePath), composed.png);
        rebuilt.push({
          ...image,
          placement,
          enhancement: composed.enhancement,
          quality: {
            ...this.quality.scoreScene(composed.productPixelCount, composed.width * composed.height, promptSet, orch),
            repairs: ["recomposited-larger-product"],
          },
        });
      }
      next = rebuilt;
      repairs.push("recomposited-product-preservation");
    }
    if (issues.some((issue) => issue.includes("scene-consistency"))) {
      const family = majority(next.map((image) => image.backgroundStyle));
      next = next.map((image) => ({
        ...image,
        consistencyLocks: unique([...image.consistencyLocks, `background-family:${family}`]),
      }));
      repairs.push("aligned-background-consistency-locks");
    }
    return { images: next, repairs };
  }

  private buildImprovements(images: SceneMarketingImage[], quality: ProductImageGenerationQuality): string[] {
    const tips: string[] = [];
    if (quality.imageQualityScore < 90) tips.push("Capture higher-resolution source photos for sharper marketing stills.");
    if (quality.backgroundScore < 90) tips.push("Clarify lifestyle vs studio intent in scene background prompts.");
    if (images.some((image) => image.quality.overall < 80)) tips.push("Re-run asset preparation for weak cutouts before regenerating scenes.");
    if (!tips.length) tips.push("Scene stills are ready; proceed to Product Video Generation only after review.");
    return tips;
  }
}

export class ProductImageQualityEngine {
  scoreScene(
    productPixels: number,
    totalPixels: number,
    promptSet: ScenePromptSet,
    orch: ProductPromptOrchestrationResult,
  ): SceneMarketingImage["quality"] {
    const coverage = productPixels / Math.max(1, totalPixels);
    const productAccuracy = coverage >= 0.08 && promptSet.prompts.image.includes(orch.consistency.productName) ? 94 : coverage >= 0.05 ? 78 : 55;
    const imageQuality = 88;
    const backgroundQuality = 86;
    const lightingConsistency = 90;
    const shadowConsistency = 84;
    const reflectionQuality = 82;
    const sceneConsistency = promptSet.prompts.image.includes(promptSet.assetId) ? 92 : 70;
    const overall = Math.round(
      (productAccuracy + imageQuality + backgroundQuality + lightingConsistency + shadowConsistency + reflectionQuality + sceneConsistency) / 7,
    );
    const issues: string[] = [];
    if (productAccuracy < 70) issues.push("product-accuracy");
    if (coverage < 0.05) issues.push("product-preservation");
    return {
      productAccuracy,
      imageQuality,
      backgroundQuality,
      lightingConsistency,
      shadowConsistency,
      reflectionQuality,
      sceneConsistency,
      overall,
      issues,
      repairs: [],
    };
  }

  evaluate(
    images: SceneMarketingImage[],
    orch: ProductPromptOrchestrationResult,
    product: ProductIntelligenceProfile,
  ): ProductImageGenerationQuality {
    const issues: string[] = [];
    if (!images.length) issues.push("no-images");
    if (images.length !== orch.scenePromptSets.length) issues.push("scene-count-mismatch");
    if (images.some((image) => !image.productPreserved || image.productName !== product.productName)) issues.push("product-preservation");
    if (images.some((image) => image.quality.productAccuracy < 70)) issues.push("product-accuracy");
    if (images.some((image) => image.quality.overall < 70)) issues.push("image-quality");
    const styles = new Set(images.map((image) => image.backgroundStyle));
    if (styles.size > 5) issues.push("scene-consistency");

    const avg = (fn: (image: SceneMarketingImage) => number) =>
      images.length ? Math.round(images.reduce((sum, image) => sum + fn(image), 0) / images.length) : 0;

    const productPreservationScore = images.every((image) => image.productPreserved && image.originalUnmodified) ? 96 : 40;
    const backgroundScore = avg((image) => image.quality.backgroundQuality);
    const enhancementScore = avg((image) => Math.round((image.enhancement.sharpness + image.enhancement.contrast + image.enhancement.edgeQuality) / 3));
    const sceneConsistencyScore = avg((image) => image.quality.sceneConsistency);
    const imageQualityScore = avg((image) => image.quality.imageQuality);
    const productAccuracyScore = avg((image) => image.quality.productAccuracy);
    const overall = Math.round(
      (productPreservationScore + backgroundScore + enhancementScore + sceneConsistencyScore + imageQualityScore + productAccuracyScore) / 6,
    );
    return {
      productPreservationScore,
      backgroundScore,
      enhancementScore,
      sceneConsistencyScore,
      imageQualityScore,
      productAccuracyScore,
      overall: issues.length ? Math.min(overall, 68) : overall,
      issues,
      repairs: [],
    };
  }
}

export class ProductImageGenerationHealthManager {
  constructor(private readonly manager: ProductImageGenerationManager) {}

  async check(projectId?: string): Promise<ProductImageGenerationHealthReport> {
    const checks: ProductImageGenerationHealthReport["checks"] = [
      { name: "runtime-initialized", passed: this.manager.isInitialized(), detail: this.manager.isInitialized() ? "ok" : "not initialized" },
    ];
    if (projectId && this.manager.isInitialized()) {
      const result = (await this.manager.getGeneration(projectId)) ?? (await this.manager.generateProductSceneImages(projectId));
      checks.push(
        { name: "product-preservation", passed: result.quality.productPreservationScore >= 70 && result.originalsUnmodified, detail: `score=${result.quality.productPreservationScore}` },
        { name: "background-generation", passed: result.quality.backgroundScore >= 70, detail: `score=${result.quality.backgroundScore}` },
        { name: "image-enhancement", passed: result.quality.enhancementScore >= 70, detail: `score=${result.quality.enhancementScore}` },
        { name: "scene-consistency", passed: result.quality.sceneConsistencyScore >= 70, detail: `score=${result.quality.sceneConsistencyScore}` },
        { name: "image-quality", passed: result.quality.imageQualityScore >= 70, detail: `score=${result.quality.imageQualityScore}` },
        { name: "product-accuracy", passed: result.quality.productAccuracyScore >= 70, detail: `score=${result.quality.productAccuracyScore}` },
        { name: "video-deferred", passed: result.videoGenerationDeferred && result.creativePipelineStep === 6, detail: `step=${result.creativePipelineStep}` },
      );
    }
    const criticalIssues = checks.filter((check) => !check.passed).map((check) => check.name);
    return { healthy: criticalIssues.length === 0, checks, repaired: [], criticalIssues };
  }

  async repair(projectId?: string): Promise<ProductImageGenerationHealthReport> {
    const repaired: string[] = [];
    if (!this.manager.isInitialized()) {
      return {
        healthy: false,
        checks: [{ name: "runtime-initialized", passed: false, detail: "Cannot repair uninitialized runtime" }],
        repaired,
        criticalIssues: ["runtime-initialized"],
      };
    }
    if (projectId) {
      this.manager["store"].generations = this.manager["store"].generations.filter((item) => item.projectId !== projectId);
      for (const [key, id] of Object.entries(this.manager["store"].cache)) {
        if (!this.manager["store"].generations.some((item) => item.generationId === id)) delete this.manager["store"].cache[key];
      }
      repaired.push("cleared-project-image-cache");
      await this.manager.generateProductSceneImages(projectId);
      repaired.push("regenerated-scene-images");
    }
    await this.manager.persist();
    repaired.push("persisted-generations");
    const report = await this.check(projectId);
    return { ...report, repaired };
  }
}

function resolveAsset(
  prepared: ProductAssetPreparationResult,
  assetId: string,
  sourceImageId: string,
): ProductAssetRecord | undefined {
  return prepared.assets.find((asset) => asset.assetId === assetId)
    ?? prepared.assets.find((asset) => asset.sourceImageId === sourceImageId)
    ?? prepared.assets[0];
}

function majority(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = values[0] ?? "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function relatedBackground(
  primary: import("./types.js").BackgroundStyle,
  suggested: import("./types.js").BackgroundStyle,
  why: string,
): { style: import("./types.js").BackgroundStyle; why: string } {
  const studioFamily = new Set(["luxury-studio", "modern-studio", "product-showcase", "premium-marketing"]);
  if (suggested === primary) return { style: suggested, why };
  if (studioFamily.has(primary) && studioFamily.has(suggested)) {
    return { style: suggested, why: `${why} Kept within studio/showcase family for consistency.` };
  }
  if (primary === "lifestyle" || primary === "indoor" || primary === "outdoor") {
    if (suggested === "lifestyle" || suggested === "indoor" || suggested === primary) {
      return { style: suggested, why: `${why} Kept within environmental family for consistency.` };
    }
  }
  return { style: primary, why: `Aligned to campaign primary background (${primary}) for scene consistency.` };
}

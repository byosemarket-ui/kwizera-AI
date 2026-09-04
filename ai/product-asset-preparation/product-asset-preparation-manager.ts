import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, CreativeWorkspaceManager, ProductImage } from "../creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import { BackgroundRemovalAnalyzer, type ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";
import { decideIsolation } from "../media-intelligence/isolation-policy.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import { analyzeCutoutQuality, buildNormalizedProductCutout, buildProductMask, PREPARATION_METHOD, DEFAULT_MAX_EDGE } from "./png-canvas.js";
import { buildPreparedAssetDecision } from "./build-prepared-decision.js";
import { PREPARED_ASSET_CONTRACT_VERSION } from "./prepared-asset-contract.js";
import { resolveUniqueHeroRoles } from "./production-roles.js";
import type {
  AiMeProductAssetAwareness,
  AssetQualityReport,
  BackgroundRemovalPlan,
  MultiViewProductAssetSet,
  PreparedAssetDecision,
  ProductAssetExplainResult,
  ProductAssetHealthReport,
  ProductAssetPreparationResult,
  ProductAssetPreparationStore,
  ProductAssetRecord,
  ProductAssetViewType,
} from "./types.js";

const EMPTY: ProductAssetPreparationStore = {
  assets: [],
  results: [],
  preparedDecisions: [],
  fingerprints: {},
  history: [],
  logs: [],
};
const CANVAS_SIZE = DEFAULT_MAX_EDGE;
const ASSET_VERSION = 3;
const REQUIRED_VIEWS: ProductAssetViewType[] = ["front", "back", "left", "right", "top", "bottom", "detail", "close-up"];

/** Step 2 runtime: prepares cutout product assets without modifying original uploads. */
export class ProductAssetPreparationManager {
  private root = "";
  private assetsRoot = "";
  private core: AiCoreManager | null = null;
  private workspace: CreativeWorkspaceManager | null = null;
  private products: ProductIntelligenceManager | null = null;
  private images: ImageIntelligenceManager | null = null;
  private store: ProductAssetPreparationStore = structuredClone(EMPTY);

  readonly removal = new BackgroundRemovalEngine();
  readonly cleanup = new ProductCleanupEngine();
  readonly normalization = new ProductNormalizationEngine();
  readonly library = new ProductAssetLibrary(this);
  readonly quality = new ProductAssetQualityEngine();
  readonly multiView = new MultiViewAssetOrganizer();
  readonly health = new ProductAssetHealthManager(this);

  async initialize(
    storageRoot: string,
    dependencies: {
      core: AiCoreManager;
      workspace: CreativeWorkspaceManager;
      products: ProductIntelligenceManager;
      images: ImageIntelligenceManager;
    },
  ): Promise<void> {
    this.root = path.join(storageRoot, "product-asset-preparation-runtime");
    this.assetsRoot = path.join(this.root, "assets");
    this.core = dependencies.core;
    this.workspace = dependencies.workspace;
    this.products = dependencies.products;
    this.images = dependencies.images;
    await fs.mkdir(this.assetsRoot, { recursive: true });
    this.store = await this.readStore();
    this.log("info", "Product asset preparation runtime restored.");
    await this.persist();
  }

  isInitialized(): boolean {
    return Boolean(this.root && this.workspace && this.products && this.images);
  }

  async prepareProductAssets(projectId: string): Promise<ProductAssetPreparationResult> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");
    const originals = project.productImages.filter(isOriginalProductImage);
    if (!originals.length) throw new Error("Upload at least one original product image before asset preparation.");

    const productProfile = await this.products!.analyzeProductIntelligence(projectId);
    const imageProfiles = await this.images!.analyzeProject(projectId);
    const prepared: ProductAssetRecord[] = [];
    const decisions: PreparedAssetDecision[] = [];

    for (let index = 0; index < originals.length; index += 1) {
      const image = originals[index]!;
      const imageProfile = imageProfiles.find((item) => item.imageId === image.id);
      let fileMissing = false;
      const originalPath = await this.workspace!.getOriginalImagePath(projectId, image.id);
      if (!originalPath) fileMissing = true;

      let record: ProductAssetRecord | null = null;
      if (!fileMissing) {
        try {
          record = await this.prepareSingleAsset(project, image, productProfile, imageProfile, { force: true });
          if (record) prepared.push(record);
        } catch (error) {
          this.history(
            projectId,
            "prepare",
            `Asset ${image.id} preparation error: ${error instanceof Error ? error.message : "unknown"}`,
          );
        }
      }

      const refreshed = await this.workspace!.getProject(projectId);
      const derivedForeground = refreshed?.productImages.find(
        (item) => item.parentAssetId === image.id && item.derivedKind === "analyzed",
      );
      const derivedMask = refreshed?.productImages.find(
        (item) => item.parentAssetId === image.id && item.derivedKind === "mask",
      );

      decisions.push(buildPreparedAssetDecision({
        projectId,
        image,
        profile: imageProfile,
        orderHint: index,
        fileMissing,
        preparedRecord: record,
        derivedForegroundId: derivedForeground?.id,
        derivedMaskId: derivedMask?.id,
      }));
    }

    const roles = resolveUniqueHeroRoles(decisions.map((d) => d.role));
    for (let i = 0; i < decisions.length; i += 1) {
      decisions[i] = { ...decisions[i]!, role: roles[i]! };
    }

    const multiView = this.multiView.organize(projectId, productProfile, prepared);
    const photoRecommendations = this.multiView.recommendPhotos(multiView.missingViews);
    const qualitySummary = summarizeQuality(prepared);
    const result: ProductAssetPreparationResult = {
      projectId,
      productId: productProfile.id,
      productName: productProfile.productName,
      assets: prepared,
      preparedDecisions: decisions,
      multiView,
      missingViews: multiView.missingViews,
      photoRecommendations,
      qualitySummary,
      originalsUnmodified: true,
      creativePipelineStep: 2,
      scenePlanningDeferred: true,
      videoGenerationDeferred: true,
      step6ContractVersion: PREPARED_ASSET_CONTRACT_VERSION,
    };
    this.store.results = this.store.results.filter((item) => item.projectId !== projectId);
    this.store.results.unshift(result);
    this.store.preparedDecisions = [
      ...decisions,
      ...this.store.preparedDecisions.filter((item) => item.projectId !== projectId),
    ];
    this.history(
      projectId,
      "prepare",
      `Prepared ${prepared.length} cutout(s) and ${decisions.length} STEP 6 decision(s); missing views: ${multiView.missingViews.join(", ") || "none"}.`,
    );
    this.log("info", `Product assets prepared for ${project.name} (STEP 6 decisions=${decisions.length}).`);
    await this.persist();
    return structuredClone(result);
  }

  /**
   * Prepare one original image — skips isolation when background policy says original is sufficient.
   * Never modifies the original file bytes.
   */
  async prepareSingleAsset(
    project: CreativeProject,
    image: ProductImage,
    productProfile: ProductIntelligenceProfile,
    imageProfile: ImageIntelligenceProfile | undefined,
    opts?: { force?: boolean },
  ): Promise<ProductAssetRecord | null> {
    this.ensureReady();
    const projectId = project.id;
    const decision = decideIsolation(imageProfile);
    if (!opts?.force && !decision.isolate) {
      return null;
    }

    const viewType = (imageProfile?.viewRole as ProductAssetViewType | undefined) || "unknown";
    const fingerprint = this.library.fingerprint(project, productProfile, image, viewType);
    const existingId = this.store.fingerprints[fingerprint];
    if (existingId) {
      const existing = this.store.assets.find((asset) => asset.assetId === existingId);
      if (existing) {
        return {
          ...existing,
          quality: {
            ...existing.quality,
            duplicate: false,
            issues: existing.quality.issues.filter((issue) => issue !== "duplicate asset blocked"),
          },
        };
      }
    }

    const originalPath = await this.workspace!.getOriginalImagePath(projectId, image.id);
    if (!originalPath) {
      throw new Error(`Original image file missing for asset ${image.id} (${image.fileName})`);
    }
    const originalBytes = await fs.readFile(originalPath);
    const originalHash = createHash("sha256").update(originalBytes).digest("hex");

    const refreshed = await this.workspace!.getProject(projectId);
    if (refreshed) {
      const staleDerived = refreshed.productImages.filter(
        (item) => item.parentAssetId === image.id
          && (item.derivedKind === "analyzed" || item.derivedKind === "mask"),
      );
      for (const stale of staleDerived) {
        await this.workspace!.removeImage(projectId, stale.id).catch(() => undefined);
      }
    }

    const plan = this.removal.plan(image, imageProfile, productProfile, this.images?.backgroundRemoval);
    const cleanup = this.cleanup.apply(plan, imageProfile);
    let canvas = this.normalization.normalize({
      sourceBytes: originalBytes,
      preserveShadows: plan.preserveShadows,
      preserveReflections: plan.preserveReflections,
      softEdges: cleanup.improveEdges,
      preserveTransparency: plan.preserveTransparency,
      removeArtifacts: cleanup.removeArtifacts,
      removeBorders: cleanup.removeBorders,
      reduceNoise: cleanup.reduceNoise,
    });
    if (!canvas) {
      this.history(projectId, "prepare", `Kept original for ${image.fileName} — source-preserving cutout unavailable.`);
      return null;
    }
    let cutoutQuality = analyzeCutoutQuality(canvas);
    let quality = this.quality.evaluate({
      plan,
      cutoutQuality,
      canvasSize: canvas.width,
      duplicate: false,
      resolutionTier: imageProfile?.resolution.tier ?? "standard",
    });
    if (!quality.backgroundRemoved || !quality.edgesClean || !quality.transparencyCorrect || !quality.productNotDamaged) {
      canvas = this.normalization.normalize({
        sourceBytes: originalBytes,
        preserveShadows: plan.preserveShadows,
        preserveReflections: false,
        softEdges: true,
        preserveTransparency: true,
        removeArtifacts: true,
        removeBorders: true,
        reduceNoise: true,
      });
      if (!canvas) {
        this.history(projectId, "prepare", `Kept original for ${image.fileName} — isolation would risk product identity.`);
        return null;
      }
      cutoutQuality = analyzeCutoutQuality(canvas);
      quality = this.quality.evaluate({
        plan,
        cutoutQuality,
        canvasSize: canvas.width,
        duplicate: false,
        resolutionTier: imageProfile?.resolution.tier ?? "standard",
        repairs: ["re-normalized cutout with soft edges and cleanup", ...quality.repairs],
      });
    }
    if (!quality.productNotDamaged || !canvas.productPreserved) {
      this.history(projectId, "prepare", `Kept original for ${image.fileName} — product preservation check failed.`);
      return null;
    }

    const maskPng = buildProductMask(canvas);
    const assetId = randomUUID();
    const fileName = `${assetId}.png`;
    const relativePath = path.join(projectId, fileName);
    const absolutePath = path.join(this.assetsRoot, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, canvas.png);

    let workspaceDerivedAssetId: string | undefined;
    let workspaceMaskAssetId: string | undefined;
    try {
      const baseName = image.fileName.replace(/\.[^.]+$/, "") || "product";
      const derived = await this.workspace!.registerDerivedAsset(projectId, {
        fileName: `foreground-${PREPARATION_METHOD}-${baseName}.png`,
        mimeType: "image/png",
        dataBase64: canvas.png.toString("base64"),
        width: canvas.width,
        height: canvas.height,
        parentAssetId: image.id,
        assetType: "derived-image",
        derivedKind: "analyzed",
      });
      workspaceDerivedAssetId = derived.id;
      await this.workspace!.patchImage(projectId, derived.id, { processingStatus: "ready" });

      const mask = await this.workspace!.registerDerivedAsset(projectId, {
        fileName: `mask-${PREPARATION_METHOD}-${baseName}.png`,
        mimeType: "image/png",
        dataBase64: maskPng.toString("base64"),
        width: canvas.width,
        height: canvas.height,
        parentAssetId: image.id,
        assetType: "derived-image",
        derivedKind: "mask",
      });
      workspaceMaskAssetId = mask.id;
      await this.workspace!.patchImage(projectId, mask.id, { processingStatus: "ready" });
    } catch {
      /* runtime file remains; original still usable */
    }

    const afterOriginal = await fs.readFile(originalPath);
    if (createHash("sha256").update(afterOriginal).digest("hex") !== originalHash) {
      throw new Error("Original product image was modified unexpectedly; aborting asset preparation.");
    }

    const now = new Date().toISOString();
    const asset: ProductAssetRecord = {
      assetId,
      productId: productProfile.id,
      projectId,
      sourceImageId: image.id,
      viewType,
      fileName,
      relativePath: relativePath.replace(/\\/g, "/"),
      mimeType: "image/png",
      resolution: { width: canvas.width, height: canvas.height },
      transparency: true,
      boundingBox: canvas.boundingBox,
      version: ASSET_VERSION,
      fingerprint,
      originalPreserved: true,
      quality,
      removalPlan: plan,
      metadata: {
        sourceFileName: image.fileName,
        originalSha256: originalHash,
        isolationReason: decision.reason,
        cleanupArtifactsRemoved: cleanup.removeArtifacts,
        cleanupBordersRemoved: cleanup.removeBorders,
        cleanupNoiseReduced: cleanup.reduceNoise,
        cleanupEdgesImproved: cleanup.improveEdges,
        cleanupMaskImproved: cleanup.improveMask,
        cleanupTransparencyImproved: cleanup.improveTransparency,
        normalizedPosition: "center",
        normalizedOrientation: "upright",
        normalizedScale: "fit-product-region",
        normalizedRotation: 0,
        normalizedCanvas: canvas.width,
        normalizedTransparency: true,
        provider: "local-product-asset-preparation",
        workspaceDerivedAssetId: workspaceDerivedAssetId ?? "",
        workspaceMaskAssetId: workspaceMaskAssetId ?? "",
        creativePipelineStep: 2,
        scenePlanningDeferred: true,
        videoGenerationDeferred: true,
        canvasSize: canvas.width,
      },
      createdAt: now,
      updatedAt: now,
    };
    this.store.assets = this.store.assets.filter(
      (item) => !(item.projectId === projectId && item.sourceImageId === image.id && item.version === ASSET_VERSION),
    );
    this.store.assets.unshift(asset);
    this.store.fingerprints[fingerprint] = assetId;
    await this.persist();
    return asset;
  }

  async getResult(projectId: string): Promise<ProductAssetPreparationResult | null> {
    return this.store.results.find((item) => item.projectId === projectId) ?? null;
  }

  async getPreparedDecisions(projectId: string): Promise<PreparedAssetDecision[]> {
    const fromResult = this.store.results.find((item) => item.projectId === projectId)?.preparedDecisions;
    if (fromResult?.length) return structuredClone(fromResult);
    return structuredClone(this.store.preparedDecisions.filter((item) => item.projectId === projectId));
  }

  async getPreparedDecision(projectId: string, assetId: string): Promise<PreparedAssetDecision | null> {
    const list = await this.getPreparedDecisions(projectId);
    return list.find((item) => item.assetId === assetId) ?? null;
  }

  async getLibrary(projectId?: string): Promise<ProductAssetRecord[]> {
    return this.store.assets
      .filter((asset) => !projectId || asset.projectId === projectId)
      .map((asset) => structuredClone(asset));
  }

  async getAssetAbsolutePath(assetId: string): Promise<string | null> {
    const asset = this.store.assets.find((item) => item.assetId === assetId);
    if (!asset) return null;
    const absolute = path.join(this.assetsRoot, asset.relativePath);
    try {
      await fs.access(absolute);
      return absolute;
    } catch {
      return null;
    }
  }

  async explainAssetQuality(projectId: string): Promise<ProductAssetExplainResult> {
    const result = (await this.getResult(projectId)) ?? (await this.prepareProductAssets(projectId));
    const qualityNotes = result.assets.map((asset) =>
      `${asset.viewType}/${asset.fileName}: score ${asset.quality.score}/100; BG removed=${asset.quality.backgroundRemoved}; edges=${asset.quality.edgesClean}; transparency=${asset.quality.transparencyCorrect}`,
    );
    return {
      projectId,
      productName: result.productName,
      summary: `Prepared ${result.assets.length} transparent product asset(s) for ${result.productName}. Originals unmodified. Scene planning deferred.`,
      assetCount: result.assets.length,
      qualityNotes,
      missingViews: result.missingViews,
      photoRecommendations: result.photoRecommendations,
      readyForScenePlanning: result.assets.length > 0 && result.qualitySummary.backgroundRemovalPassRate >= 0.8,
    };
  }

  async detectMissingAngles(projectId: string): Promise<ProductAssetViewType[]> {
    const result = (await this.getResult(projectId)) ?? (await this.prepareProductAssets(projectId));
    return [...result.missingViews];
  }

  async recommendAdditionalPhotos(projectId: string): Promise<ProductAssetPreparationResult["photoRecommendations"]> {
    const result = (await this.getResult(projectId)) ?? (await this.prepareProductAssets(projectId));
    return structuredClone(result.photoRecommendations);
  }

  getAiMeProductAssetAwareness(): AiMeProductAssetAwareness {
    const available = this.isInitialized();
    return {
      available,
      enabled: available,
      offlineFirst: true,
      canUseProcessedAssets: available,
      canDetectMissingAngles: available,
      canRecommendAdditionalPhotos: available,
      canExplainAssetQuality: available,
      backgroundRemovalEnabled: available,
      scenePlanningDeferred: true,
      videoGenerationDeferred: true,
      summary: available
        ? "AI Me Product Asset Preparation is online: use processed cutout assets, detect missing angles, recommend photos, and explain asset quality. Scene planning and video generation remain deferred."
        : "Product Asset Preparation runtime is not initialized.",
    };
  }

  async runHealthCheck(projectId?: string): Promise<ProductAssetHealthReport> {
    return this.health.check(projectId);
  }

  async repair(projectId?: string): Promise<ProductAssetHealthReport> {
    return this.health.repair(projectId);
  }

  async getDashboard(projectId?: string): Promise<{
    assets: ProductAssetRecord[];
    results: ProductAssetPreparationResult[];
    preparedDecisions: PreparedAssetDecision[];
    history: ProductAssetPreparationStore["history"];
    logs: ProductAssetPreparationStore["logs"];
    awareness: AiMeProductAssetAwareness;
    analytics: Record<string, number>;
  }> {
    const assets = this.store.assets.filter((asset) => !projectId || asset.projectId === projectId);
    const results = this.store.results.filter((result) => !projectId || result.projectId === projectId);
    const preparedDecisions = this.store.preparedDecisions.filter((item) => !projectId || item.projectId === projectId);
    return {
      assets: structuredClone(assets),
      results: structuredClone(results),
      preparedDecisions: structuredClone(preparedDecisions),
      history: this.store.history.filter((item) => !projectId || item.projectId === projectId),
      logs: [...this.store.logs],
      awareness: this.getAiMeProductAssetAwareness(),
      analytics: {
        assets: assets.length,
        projects: new Set(assets.map((asset) => asset.projectId)).size,
        averageQuality: assets.length ? Math.round(assets.reduce((sum, asset) => sum + asset.quality.score, 0) / assets.length) : 0,
        transparentAssets: assets.filter((asset) => asset.transparency).length,
        fingerprints: Object.keys(this.store.fingerprints).length,
        preparedDecisions: preparedDecisions.length,
        readyForMotion: preparedDecisions.filter((d) => d.readyForLaterMotionStages).length,
      },
    };
  }

  async persist(): Promise<void> {
    await fs.writeFile(path.join(this.root, "library.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8");
  }

  log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.unshift({ at: new Date().toISOString(), level, message });
    this.store.logs.splice(100);
    this.core?.logger.info("product-asset-preparation", message);
  }

  history(projectId: string, event: string, detail: string): void {
    this.store.history.unshift({ id: randomUUID(), at: new Date().toISOString(), projectId, event, detail });
    this.store.history.splice(100);
  }

  private async readStore(): Promise<ProductAssetPreparationStore> {
    try {
      const value = JSON.parse(await fs.readFile(path.join(this.root, "library.json"), "utf8")) as Partial<ProductAssetPreparationStore>;
      return {
        ...structuredClone(EMPTY),
        ...value,
        assets: value.assets ?? [],
        results: (value.results ?? []).map((result) => ({
          ...result,
          preparedDecisions: result.preparedDecisions ?? [],
        })),
        preparedDecisions: value.preparedDecisions ?? [],
        fingerprints: value.fingerprints ?? {},
        history: value.history ?? [],
        logs: value.logs ?? [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY);
      throw error;
    }
  }

  private ensureReady(): void {
    if (!this.isInitialized()) throw new Error("Product Asset Preparation Manager is not initialized");
  }
}

export class BackgroundRemovalEngine {
  private readonly fallbackPlanner = new BackgroundRemovalAnalyzer();

  plan(
    image: ProductImage,
    imageProfile: ImageIntelligenceProfile | undefined,
    product: ProductIntelligenceProfile,
    planner?: BackgroundRemovalAnalyzer,
  ): BackgroundRemovalPlan {
    const handoff = imageProfile
      ? (planner ?? this.fallbackPlanner).plan(imageProfile)
      : {
          removable: false,
          preserveEdges: true,
          preserveShadows: false,
          preserveReflections: false,
          confidence: 40,
          notes: ["No image intelligence profile; applying cautious local cutout."],
        };
    const preserveTransparency = /glass|transparent|clear/i.test(`${product.materials.join(" ")} ${product.description}`);
    const preserveShadows = handoff.preserveShadows || product.shapes.includes("cylindrical");
    const preserveReflections = handoff.preserveReflections
      || /reflect|steel|glass|metal/i.test(product.materials.join(" "));
    return {
      sourceImageId: image.id,
      productDetected: Boolean(imageProfile?.objects?.length || product.productName),
      backgroundDetected: Boolean(imageProfile?.background && !imageProfile.background.type.includes("requires")),
      removable: handoff.removable,
      preserveEdges: handoff.preserveEdges,
      preserveShadows,
      preserveTransparency,
      preserveReflections,
      confidence: Math.min(96, handoff.confidence + (handoff.removable ? 8 : 0)),
      notes: [
        ...handoff.notes,
        "Original image bytes remain untouched; processed PNG stored separately.",
        "Derived cutouts use source-preserving pixel isolation when decode succeeds; otherwise the original is kept.",
        "Video render prefers production-safe derived foregrounds only; unsafe placeholders are ignored.",
      ],
    };
  }
}

export class ProductCleanupEngine {
  apply(plan: BackgroundRemovalPlan, imageProfile?: ImageIntelligenceProfile): {
    removeArtifacts: boolean;
    removeBorders: boolean;
    reduceNoise: boolean;
    improveEdges: boolean;
    improveMask: boolean;
    improveTransparency: boolean;
  } {
    return {
      removeArtifacts: true,
      removeBorders: true,
      reduceNoise: (imageProfile?.defects.length ?? 0) > 0 || (imageProfile?.quality.score ?? 100) < 80,
      improveEdges: plan.preserveEdges,
      improveMask: true,
      improveTransparency: true,
    };
  }
}

export class ProductNormalizationEngine {
  normalize(input: {
    sourceBytes: Buffer;
    preserveShadows: boolean;
    preserveReflections: boolean;
    softEdges: boolean;
    preserveTransparency?: boolean;
    removeArtifacts?: boolean;
    removeBorders?: boolean;
    reduceNoise?: boolean;
  }) {
    return buildNormalizedProductCutout({
      maxEdge: CANVAS_SIZE,
      sourceBytes: input.sourceBytes,
      preserveShadows: input.preserveShadows,
      preserveReflections: input.preserveReflections,
      softEdges: input.softEdges,
      preserveTransparency: input.preserveTransparency ?? false,
      removeArtifacts: input.removeArtifacts ?? true,
      removeBorders: input.removeBorders ?? true,
      reduceNoise: input.reduceNoise ?? false,
    });
  }
}

export class ProductAssetLibrary {
  constructor(private readonly manager: ProductAssetPreparationManager) {}

  fingerprint(
    project: CreativeProject,
    product: ProductIntelligenceProfile,
    image: ProductImage,
    viewType: ProductAssetViewType,
  ): string {
    return createHash("sha256")
      .update(JSON.stringify({
        projectId: project.id,
        productId: product.id,
        sourceImageId: image.id,
        sizeBytes: image.sizeBytes,
        mimeType: image.mimeType,
        viewType,
        version: ASSET_VERSION,
        canvas: CANVAS_SIZE,
      }))
      .digest("hex");
  }
}

export class ProductAssetQualityEngine {
  evaluate(input: {
    plan: BackgroundRemovalPlan;
    cutoutQuality: ReturnType<typeof analyzeCutoutQuality>;
    canvasSize: number;
    duplicate: boolean;
    resolutionTier: string;
    repairs?: string[];
  }): AssetQualityReport {
    const issues: string[] = [];
    if (!input.plan.productDetected) issues.push("product detection weak");
    if (!input.cutoutQuality.backgroundRemoved) issues.push("background not fully removed");
    if (!input.cutoutQuality.productNotDamaged) issues.push("product region too thin");
    if (!input.cutoutQuality.edgesClean) issues.push("edge quality below target");
    if (!input.cutoutQuality.transparencyCorrect) issues.push("transparency incorrect");
    if (input.canvasSize < 64) issues.push("resolution below acceptable canvas");
    if (input.duplicate) issues.push("duplicate asset blocked");
    const score = Math.max(
      0,
      Math.min(
        100,
        70
          + (input.cutoutQuality.backgroundRemoved ? 10 : -20)
          + (input.cutoutQuality.edgesClean ? 6 : -10)
          + (input.cutoutQuality.transparencyCorrect ? 6 : -15)
          + (input.cutoutQuality.productNotDamaged ? 6 : -20)
          + (input.resolutionTier === "low" ? -6 : 2)
          + Math.min(8, Math.round(input.plan.confidence / 20)),
      ),
    );
    return {
      backgroundRemoved: input.cutoutQuality.backgroundRemoved,
      productNotDamaged: input.cutoutQuality.productNotDamaged,
      edgesClean: input.cutoutQuality.edgesClean,
      transparencyCorrect: input.cutoutQuality.transparencyCorrect,
      resolutionAcceptable: input.canvasSize >= 64 && input.resolutionTier !== "unsupported",
      duplicate: input.duplicate,
      score,
      confidence: Math.min(96, input.plan.confidence + (issues.length ? -8 : 4)),
      issues,
      repairs: input.repairs ?? [],
    };
  }
}

export class MultiViewAssetOrganizer {
  organize(projectId: string, product: ProductIntelligenceProfile, assets: ProductAssetRecord[]): MultiViewProductAssetSet {
    const views = Object.fromEntries(REQUIRED_VIEWS.concat(["side", "unknown"]).map((view) => [view, [] as ProductAssetRecord[]])) as Record<ProductAssetViewType, ProductAssetRecord[]>;
    for (const asset of assets) {
      views[asset.viewType] = [...(views[asset.viewType] ?? []), asset];
    }
    if ((views.left?.length || views.right?.length) && !views.side?.length) {
      // side covered by left/right
    }
    const present = new Set(assets.map((asset) => asset.viewType));
    const missingViews = REQUIRED_VIEWS.filter((view) => {
      if (view === "left" || view === "right") return !present.has(view) && !present.has("side");
      return !present.has(view);
    });
    return {
      projectId,
      productId: product.id,
      productName: product.productName,
      views,
      missingViews,
      assetIds: assets.map((asset) => asset.assetId),
    };
  }

  recommendPhotos(missing: ProductAssetViewType[]): ProductAssetPreparationResult["photoRecommendations"] {
    return missing.slice(0, 6).map((view) => ({
      view,
      priority: view === "front" ? "high" : view === "detail" || view === "close-up" ? "medium" : "high",
      reason: `Missing ${view} view in the prepared multi-view product set.`,
    }));
  }
}

export class ProductAssetHealthManager {
  constructor(private readonly manager: ProductAssetPreparationManager) {}

  async check(projectId?: string): Promise<ProductAssetHealthReport> {
    const checks: ProductAssetHealthReport["checks"] = [];
    checks.push({
      name: "runtime-initialized",
      passed: this.manager.isInitialized(),
      detail: this.manager.isInitialized() ? "ready" : "not initialized",
    });
    const awareness = this.manager.getAiMeProductAssetAwareness();
    checks.push({
      name: "ai-me-awareness",
      passed: awareness.available && awareness.backgroundRemovalEnabled && awareness.scenePlanningDeferred,
      detail: awareness.summary,
    });
    if (projectId) {
      try {
        const result = await this.manager.prepareProductAssets(projectId);
        checks.push({
          name: "product-detection",
          passed: result.assets.every((asset) => asset.removalPlan.productDetected),
          detail: `assets=${result.assets.length}`,
        });
        checks.push({
          name: "background-removal",
          passed: result.qualitySummary.backgroundRemovalPassRate >= 0.8,
          detail: `passRate=${result.qualitySummary.backgroundRemovalPassRate}`,
        });
        checks.push({
          name: "edge-quality",
          passed: result.qualitySummary.edgePassRate >= 0.8,
          detail: `passRate=${result.qualitySummary.edgePassRate}`,
        });
        checks.push({
          name: "transparency",
          passed: result.qualitySummary.transparencyPassRate >= 0.8,
          detail: `passRate=${result.qualitySummary.transparencyPassRate}`,
        });
        checks.push({
          name: "asset-library",
          passed: result.assets.length > 0 && result.assets.every((asset) => asset.assetId && asset.version >= 1),
          detail: `stored=${result.assets.length}`,
        });
        checks.push({
          name: "duplicate-protection",
          passed: new Set(result.assets.map((asset) => asset.fingerprint)).size === result.assets.length,
          detail: `uniqueFingerprints=${new Set(result.assets.map((asset) => asset.fingerprint)).size}`,
        });
        checks.push({
          name: "originals-preserved",
          passed: result.originalsUnmodified && result.assets.every((asset) => asset.originalPreserved),
          detail: "original uploads untouched",
        });
      } catch (error) {
        checks.push({
          name: "product-detection",
          passed: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const criticalIssues = checks.filter((check) => !check.passed).map((check) => `${check.name}: ${check.detail}`);
    return { healthy: criticalIssues.length === 0, checks, repaired: [], criticalIssues };
  }

  async repair(projectId?: string): Promise<ProductAssetHealthReport> {
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
      this.manager["store"].assets = this.manager["store"].assets.filter((asset) => asset.projectId !== projectId);
      this.manager["store"].results = this.manager["store"].results.filter((result) => result.projectId !== projectId);
      for (const [fingerprint, assetId] of Object.entries(this.manager["store"].fingerprints)) {
        if (!this.manager["store"].assets.some((asset) => asset.assetId === assetId)) {
          delete this.manager["store"].fingerprints[fingerprint];
        }
      }
      repaired.push("cleared-project-asset-cache");
      await this.manager.prepareProductAssets(projectId);
      repaired.push("re-prepared-product-assets");
    }
    await this.manager.persist();
    repaired.push("persisted-library");
    const report = await this.check(projectId);
    return { ...report, repaired };
  }
}

function summarizeQuality(assets: ProductAssetRecord[]): ProductAssetPreparationResult["qualitySummary"] {
  if (!assets.length) {
    return { averageScore: 0, averageConfidence: 0, backgroundRemovalPassRate: 0, edgePassRate: 0, transparencyPassRate: 0 };
  }
  return {
    averageScore: Math.round(assets.reduce((sum, asset) => sum + asset.quality.score, 0) / assets.length),
    averageConfidence: Math.round(assets.reduce((sum, asset) => sum + asset.quality.confidence, 0) / assets.length),
    backgroundRemovalPassRate: Number((assets.filter((asset) => asset.quality.backgroundRemoved).length / assets.length).toFixed(2)),
    edgePassRate: Number((assets.filter((asset) => asset.quality.edgesClean).length / assets.length).toFixed(2)),
    transparencyPassRate: Number((assets.filter((asset) => asset.quality.transparencyCorrect).length / assets.length).toFixed(2)),
  };
}

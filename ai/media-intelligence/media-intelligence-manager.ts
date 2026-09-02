/**
 * Step 2 — Media Intelligence Foundation orchestrator.
 * Reuses ImageIntelligence, ProductIntelligence, CanonicalProduct, and AssetPreparation managers.
 */
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { ProductAssetPreparationManager } from "../product-asset-preparation/product-asset-preparation-manager.js";
import type { CanonicalProductManager } from "../product-record/canonical-product-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { VisionProvider } from "../ai-provider/vision-capabilities.js";
import { UnconfiguredVisionProvider } from "../ai-provider/vision-capabilities.js";
import { assessOllamaReadiness } from "./ollama-readiness.js";
import { decideIsolation } from "./isolation-policy.js";
import { countUsableAssets, mapQualityToMediaStatus } from "./quality-status.js";
import type { MediaAssetEntry, MediaIntelligenceReport, ProductIntelligenceSummary } from "./types.js";

const PIPELINE_VERSION = "step4-image-prep-v1";

export class MediaIntelligenceManager {
  private workspace: CreativeWorkspaceManager | null = null;
  private images: ImageIntelligenceManager | null = null;
  private products: ProductIntelligenceManager | null = null;
  private canonical: CanonicalProductManager | null = null;
  private assets: ProductAssetPreparationManager | null = null;
  private vision: VisionProvider = new UnconfiguredVisionProvider();

  async initialize(dependencies: {
    workspace: CreativeWorkspaceManager;
    images: ImageIntelligenceManager;
    products: ProductIntelligenceManager;
    canonical: CanonicalProductManager;
    assets: ProductAssetPreparationManager;
    vision?: VisionProvider;
  }): Promise<void> {
    this.workspace = dependencies.workspace;
    this.images = dependencies.images;
    this.products = dependencies.products;
    this.canonical = dependencies.canonical;
    this.assets = dependencies.assets;
    if (dependencies.vision) this.vision = dependencies.vision;
  }

  isInitialized(): boolean {
    return Boolean(this.workspace && this.images && this.products && this.assets);
  }

  setVisionProvider(provider: VisionProvider): void {
    this.vision = provider;
  }

  /** Process a single uploaded asset — safe, non-blocking, never overwrites originals. */
  async processAsset(projectId: string, assetId: string): Promise<MediaAssetEntry | null> {
    this.ensureReady();
    let profileError: string | undefined;
    let profile;
    try {
      profile = await this.images!.analyzeAsset(projectId, assetId);
    } catch (error) {
      profileError = error instanceof Error ? error.message : "Analysis failed";
    }

    if (profile && this.vision) {
      try {
        const available = await this.vision.isAvailable();
        if (available) {
          const project = await this.workspace!.getProject(projectId);
          const image = project?.productImages.find((item) => item.id === assetId);
          if (image) {
            let imageBase64: string | undefined;
            try {
              const imagePath = await this.workspace!.getOriginalImagePath(projectId, assetId);
              if (imagePath) {
                const { readFile } = await import("node:fs/promises");
                const bytes = await readFile(imagePath);
                if (bytes.byteLength > 0 && bytes.byteLength <= 2_500_000) {
                  imageBase64 = bytes.toString("base64");
                }
              }
            } catch {
              imageBase64 = undefined;
            }
            await this.vision.analyzeImage({
              projectId,
              assetId,
              mimeType: image.mimeType,
              fileName: image.fileName,
              userProductName: project?.productInformation?.name,
              userCategory: project?.productInformation?.category,
              imageBase64,
            });
          }
        }
      } catch {
        /* vision enrichment is optional */
      }
    }

    if (profile) {
      const project = await this.workspace!.getProject(projectId);
      const image = project?.productImages.find((item) => item.id === assetId);
      const decision = decideIsolation(profile);
      if (decision.isolate && image && project) {
        try {
          const productProfile = await this.products!.analyzeProductIntelligence(projectId);
          await this.assets!.prepareSingleAsset(project, image, productProfile, profile);
        } catch {
          /* isolation failure must not block upload — original remains */
        }
      }
    }

    await this.canonical?.sync(projectId).catch(() => null);
    return this.buildAssetEntry(projectId, assetId, profileError);
  }

  /** Full project media intelligence — analysis, isolation, canonical registry update. */
  async prepareProject(projectId: string, opts?: { skipIsolation?: boolean }): Promise<MediaIntelligenceReport> {
    this.ensureReady();
    const failures: string[] = [];

    let imageProfiles;
    try {
      imageProfiles = await this.images!.analyzeProject(projectId);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Image analysis failed");
      imageProfiles = [];
    }

    let productProfile;
    try {
      productProfile = await this.products!.analyzeProductIntelligence(projectId);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Product intelligence failed");
    }

    await this.canonical?.sync(projectId).catch((error) => {
      failures.push(error instanceof Error ? error.message : "Canonical sync failed");
    });

    if (!opts?.skipIsolation) {
      try {
        await this.assets!.prepareProductAssets(projectId);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : "Asset isolation failed");
      }
    }

    return this.buildReport(projectId, failures);
  }

  async getReport(projectId: string): Promise<MediaIntelligenceReport> {
    return this.buildReport(projectId, []);
  }

  private async buildReport(projectId: string, failures: string[]): Promise<MediaIntelligenceReport> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");

    const originals = project.productImages.filter(isOriginalProductImage);
    const imageProfiles = await this.images!.getProfiles(projectId).catch(() => []);
    const prepResult = await this.assets!.getResult(projectId).catch(() => null);
    const productProfile = await this.products!.getProfile(projectId).catch(() => null);
    const ollama = await assessOllamaReadiness();

    const assets: MediaAssetEntry[] = [];
    for (const image of originals) {
      const profile = imageProfiles.find((p) => p.imageId === image.id);
      const prepAsset = prepResult?.assets.find((a) => a.sourceImageId === image.id);
      const derivedForeground = project.productImages.find(
        (item) => item.parentAssetId === image.id && item.derivedKind === "analyzed",
      );
      const derivedMask = project.productImages.find(
        (item) => item.parentAssetId === image.id && item.derivedKind === "mask",
      );
      const status = mapQualityToMediaStatus(profile, false);
      const isolation = decideIsolation(profile);
      assets.push({
        assetId: image.id,
        projectId,
        fileName: image.fileName,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        width: image.width,
        height: image.height,
        status,
        analysisState: profile?.analysisState ?? "unavailable",
        processingState: prepAsset ? "ready" : (profile?.processingState ?? "pending"),
        preparationDecision: isolation.decision,
        view: profile ? { role: profile.viewRole, confidence: profile.boundaries.confidence } : undefined,
        background: profile ? {
          type: profile.background.type,
          removable: profile.background.removable,
          confidence: profile.background.confidence,
          suitability: profile.background.removalSuitability,
        } : undefined,
        quality: profile ? {
          score: profile.quality.score,
          classification: profile.quality.classification,
          confidence: profile.quality.confidence,
        } : undefined,
        derivedForegroundId: derivedForeground?.id ?? prepAsset?.metadata?.workspaceDerivedAssetId as string | undefined,
        derivedMaskId: derivedMask?.id ?? prepAsset?.metadata?.workspaceMaskAssetId as string | undefined,
        derivedThumbnailId: profile?.derivedThumbnailId,
        originalPreserved: true,
        errors: [],
      });
    }

    const statuses = assets.map((a) => a.status);
    const productIntelligence = this.buildProductSummary(project, productProfile);

    return {
      projectId,
      productId: productProfile?.id ?? projectId,
      checkedAt: new Date().toISOString(),
      pipelineVersion: PIPELINE_VERSION,
      assets,
      productIntelligence,
      summary: {
        total: assets.length,
        ready: statuses.filter((s) => s === "READY").length,
        needsReview: statuses.filter((s) => s === "NEEDS_REVIEW").length,
        lowQuality: statuses.filter((s) => s === "LOW_QUALITY").length,
        failed: statuses.filter((s) => s === "FAILED").length,
        processing: statuses.filter((s) => s === "PROCESSING").length,
        usableCount: countUsableAssets(statuses),
        productAnalysisReady: Boolean(productIntelligence),
        isolationReady: Boolean(prepResult?.assets.length),
      },
      failures,
      ollamaReady: ollama.ready,
      ollamaNote: ollama.notes.join(" "),
    };
  }

  private async buildAssetEntry(
    projectId: string,
    assetId: string,
    error?: string,
  ): Promise<MediaAssetEntry | null> {
    const project = await this.workspace!.getProject(projectId);
    const image = project?.productImages.find((item) => item.id === assetId);
    if (!image || !isOriginalProductImage(image)) return null;
    const profiles = await this.images!.getProfiles(projectId).catch(() => []);
    const profile = profiles.find((p) => p.imageId === assetId);
    const isolation = decideIsolation(profile);
    const children = project?.productImages.filter((item) => item.parentAssetId === assetId) ?? [];
    const foreground = children.find((item) => item.derivedKind === "analyzed");
    const mask = children.find((item) => item.derivedKind === "mask");
    return {
      assetId,
      projectId,
      fileName: image.fileName,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      width: image.width,
      height: image.height,
      status: mapQualityToMediaStatus(profile, Boolean(error)),
      analysisState: profile?.analysisState ?? (error ? "failed" : "unavailable"),
      processingState: profile?.processingState ?? "pending",
      preparationDecision: isolation.decision,
      view: profile ? { role: profile.viewRole, confidence: profile.boundaries.confidence } : undefined,
      background: profile ? {
        type: profile.background.type,
        removable: profile.background.removable,
        confidence: profile.background.confidence,
        suitability: profile.background.removalSuitability,
      } : undefined,
      quality: profile ? {
        score: profile.quality.score,
        classification: profile.quality.classification,
        confidence: profile.quality.confidence,
      } : undefined,
      derivedForegroundId: foreground?.id,
      derivedMaskId: mask?.id,
      derivedThumbnailId: profile?.derivedThumbnailId,
      originalPreserved: true,
      errors: error ? [error] : [],
    };
  }

  private buildProductSummary(
    project: Awaited<ReturnType<CreativeWorkspaceManager["getProject"]>> & object,
    productProfile: Awaited<ReturnType<ProductIntelligenceManager["getProfile"]>> | null | undefined,
  ): ProductIntelligenceSummary | null {
    if (!project) return null;
    const userName = project.productInformation?.name?.trim();
    const userCategory = project.productInformation?.category?.trim();
    if (!userName && !productProfile) return null;

    return {
      productName: userName || productProfile?.productName || project.name,
      category: userCategory || productProfile?.category || "General",
      description: project.productInformation?.description?.trim()
        || productProfile?.description
        || "",
      visualAttributes: [
        ...(productProfile?.features ?? []),
        ...(productProfile?.shapes ?? []),
      ].slice(0, 12),
      colors: (productProfile?.colours ?? []).map((name) => ({
        name,
        confidence: 0.85,
      })),
      materials: productProfile?.materials ?? [],
      availableViews: (productProfile?.multiView?.views ?? []).map((v) => ({
        view: v.role,
        assetId: v.imageId,
        confidence: v.duplicateOf ? 0.5 : 0.9,
      })),
      userAuthoritative: Boolean(userName || userCategory),
    };
  }

  private ensureReady(): void {
    if (!this.isInitialized()) throw new Error("Media intelligence manager is not initialized");
  }
}

export { resolveProductionImagePath } from "./asset-resolver.js";

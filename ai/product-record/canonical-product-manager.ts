import fs from "node:fs/promises";
import path from "node:path";
import type { CreativeProject, CreativeWorkspaceManager, ProductImage } from "../creative-workspace/creative-workspace-manager.js";
import { classifyAssetBucket, isSafeProjectId } from "../creative-workspace/project-asset.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import { humanizeList, humanizeValue } from "./humanize.js";
import type {
  AssetLifecycleStatus,
  CanonicalAsset,
  CanonicalProduct,
  ProductIntelligenceOutput,
  ProductReadinessState,
  ProductViewEntry,
} from "./types.js";
import {
  CANONICAL_VIEWS,
  detectCanonicalView,
  emptyAssetMap,
  fromProductViewRole,
  normalizeViewKind,
  toProductViewRole,
  type CanonicalViewKind,
} from "./view-kinds.js";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
  "image/x-ms-bmp": "bmp",
  "video/mp4": "mp4",
};

function storedExtension(image: ProductImage): string {
  return EXT_BY_MIME[image.mimeType]
    ?? (image.mimeType === "image/jpeg" ? "jpeg" : image.mimeType.split("/")[1]?.replace("x-ms-", "") ?? "bin");
}

function slugType(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "unknown_product";
}

/**
 * Canonical product record — one source of truth for identity, original assets,
 * view intelligence, and production readiness. Later stages resolve files by
 * productId → assetId → verified production path.
 */
export class CanonicalProductManager {
  private root = "";
  private workspace: CreativeWorkspaceManager | null = null;
  private images: ImageIntelligenceManager | null = null;
  private products: ProductIntelligenceManager | null = null;

  async initialize(
    storageRoot: string,
    dependencies: {
      workspace: CreativeWorkspaceManager;
      images?: ImageIntelligenceManager | null;
      products?: ProductIntelligenceManager | null;
    },
  ): Promise<void> {
    this.root = path.join(storageRoot, "creative-workspace", "projects");
    this.workspace = dependencies.workspace;
    this.images = dependencies.images ?? null;
    this.products = dependencies.products ?? null;
    await fs.mkdir(this.root, { recursive: true });
  }

  isInitialized(): boolean {
    return Boolean(this.root && this.workspace);
  }

  attachIntelligence(images: ImageIntelligenceManager, products: ProductIntelligenceManager): void {
    this.images = images;
    this.products = products;
  }

  async get(projectId: string): Promise<CanonicalProduct | null> {
    this.ensureReady();
    if (!isSafeProjectId(projectId)) return null;
    return this.load(projectId);
  }

  async sync(projectId: string): Promise<CanonicalProduct> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");
    return this.rebuild(project);
  }

  async correctView(
    projectId: string,
    assetId: string,
    view: string,
  ): Promise<CanonicalProduct> {
    this.ensureReady();
    const canonicalView = normalizeViewKind(view);
    const existing = (await this.load(projectId)) ?? (await this.sync(projectId));
    const current = existing.productViews.find((entry) => entry.assetId === assetId);
    const nextViews = existing.productViews.filter((entry) => entry.assetId !== assetId);
    nextViews.push({
      assetId,
      view: canonicalView,
      confidence: 1,
      source: "user",
      previousView: current?.view,
      correctedAt: new Date().toISOString(),
    });
    const asset = existing.originalAssets.find((item) => item.assetId === assetId);
    if (asset && asset.processingStatus !== "FAILED") {
      asset.processingStatus = asset.processingStatus === "UPLOADED" ? "ANALYZED" : asset.processingStatus;
    }
    existing.productViews = nextViews;
    this.applyAssetMap(existing);
    this.refreshReadiness(existing);
    existing.updatedAt = new Date().toISOString();
    await this.save(existing);

    if (this.images?.isInitialized()) {
      await this.images.overrideViewRole(projectId, assetId, toProductViewRole(canonicalView), 1).catch(() => undefined);
    }
    return existing;
  }

  async resolveProductionPath(projectId: string, assetId: string): Promise<{
    assetId: string;
    view: CanonicalViewKind;
    absolutePath: string;
    productionUrl: string;
    originalFilename: string;
  } | null> {
    this.ensureReady();
    const product = (await this.load(projectId)) ?? (await this.sync(projectId));
    const asset = product.originalAssets.find((item) => item.assetId === assetId);
    if (!asset) return null;
    const absolutePath = await this.workspace!.getOriginalImagePath(projectId, assetId);
    if (!absolutePath) return null;
    const view = product.productViews.find((entry) => entry.assetId === assetId)?.view ?? "unknown";
    return {
      assetId,
      view,
      absolutePath,
      productionUrl: asset.productionUrl,
      originalFilename: asset.originalFilename,
    };
  }

  async listVerifiedOriginals(projectId: string): Promise<Array<{
    assetId: string;
    view: CanonicalViewKind;
    absolutePath: string;
    productionUrl: string;
  }>> {
    const product = (await this.load(projectId)) ?? (await this.sync(projectId));
    const resolved: Array<{ assetId: string; view: CanonicalViewKind; absolutePath: string; productionUrl: string }> = [];
    for (const asset of product.originalAssets) {
      const pathResolved = await this.resolveProductionPath(projectId, asset.assetId);
      if (pathResolved) resolved.push(pathResolved);
    }
    return resolved;
  }

  private async rebuild(project: CreativeProject): Promise<CanonicalProduct> {
    const previous = await this.load(project.id);
    const userCorrections = new Map(
      (previous?.productViews ?? [])
        .filter((entry) => entry.source === "user")
        .map((entry) => [entry.assetId, entry]),
    );

    const imageProfiles = this.images?.isInitialized()
      ? await this.images.getProfiles(project.id)
      : [];
    const productProfile = this.products?.isInitialized()
      ? await this.products.getProfile(project.id)
      : null;

    const originalAssets: CanonicalAsset[] = [];
    const processedAssets: CanonicalAsset[] = [];
    const productionAssets: CanonicalAsset[] = [];
    const finalOutputs: CanonicalAsset[] = [];
    const productViews: ProductViewEntry[] = [];

    for (const image of project.productImages) {
      const bucket = classifyAssetBucket(image);
      const record = await this.toCanonicalAsset(project, image, bucket, imageProfiles.some((p) => p.imageId === image.id));
      if (bucket === "original") originalAssets.push(record);
      else if (bucket === "processed") processedAssets.push(record);
      else if (bucket === "final") finalOutputs.push(record);
      else productionAssets.push(record);

      if (bucket !== "original") continue;

      const user = userCorrections.get(image.id);
      if (user) {
        productViews.push({ ...user, assetId: image.id });
        continue;
      }

      const profile = imageProfiles.find((item) => item.imageId === image.id);
      const userCorrectedOnProfile = profile?.metadata?.userCorrected === 1;
      if (userCorrectedOnProfile && profile?.viewRole) {
        productViews.push({
          assetId: image.id,
          view: fromProductViewRole(String(profile.viewRole)),
          confidence: 1,
          source: "user",
          previousView: profile.metadata.previousViewRole
            ? fromProductViewRole(String(profile.metadata.previousViewRole))
            : undefined,
        });
        continue;
      }

      if (profile?.viewRole) {
        const confidence = typeof profile.metadata?.viewConfidence === "number"
          ? Number(profile.metadata.viewConfidence) / 100
          : 0.7;
        const view = confidence < 0.55 ? "unknown" : fromProductViewRole(String(profile.viewRole));
        productViews.push({
          assetId: image.id,
          view,
          confidence,
          source: "ai",
        });
        continue;
      }

      const detected = detectCanonicalView(image.sourceFileName ?? image.fileName);
      productViews.push({
        assetId: image.id,
        view: detected.confidence < 0.55 ? "unknown" : detected.view,
        confidence: detected.confidence,
        source: "filename",
      });
    }

    const sellingPoints = humanizeList(productProfile?.sellingPoints);
    const features = humanizeList(productProfile?.features);
    const materials = humanizeList(productProfile?.materials);
    const colours = humanizeList(productProfile?.colours);
    const category = humanizeValue(productProfile?.category) || project.productInformation.category || "unknown";
    const productType = slugType(humanizeValue(productProfile?.productType) || category);
    const viewConfidences = productViews.map((entry) => entry.confidence);
    const viewsConfidence = viewConfidences.length
      ? viewConfidences.reduce((sum, item) => sum + item, 0) / viewConfidences.length
      : 0;
    const categoryConfidence = (productProfile?.quality.confidence ?? 0) / 100;
    const analysisCompleted = Boolean(productProfile) || originalAssets.some((asset) => asset.processingStatus === "ANALYZED" || asset.processingStatus === "READY");

    const assetMap = emptyAssetMap();
    for (const entry of productViews) {
      assetMap[entry.view] = [...(assetMap[entry.view] ?? []), entry.assetId];
    }
    const intelligence: ProductIntelligenceOutput | null = originalAssets.length
      ? {
        productType,
        category,
        productViews: Object.fromEntries(
          CANONICAL_VIEWS
            .filter((view) => (assetMap[view] ?? []).length > 0)
            .map((view) => [view, assetMap[view]]),
        ),
        visualFeatures: unique([...features, ...materials, ...colours]).slice(0, 12),
        confidence: {
          category: Number(categoryConfidence.toFixed(2)),
          views: Number(viewsConfidence.toFixed(2)),
        },
      }
      : null;

    const product: CanonicalProduct = {
      version: 1,
      productId: project.id,
      projectId: project.id,
      projectName: project.name,
      identity: {
        name: project.productInformation.name || project.name,
        brand: project.brandInformation?.name || humanizeValue(productProfile?.brand) || "",
        category,
        productType,
      },
      originalAssets,
      processedAssets,
      productionAssets,
      finalOutputs,
      productViews,
      assetMap,
      visualAnalysis: {
        features,
        materials,
        colours,
        analyzedAt: productProfile?.updatedAt ?? null,
      },
      productFeatures: features,
      marketingData: {
        sellingPoints,
        targetAudience: humanizeValue(productProfile?.targetAudience) || project.targetAudience || "",
        keywords: humanizeList(productProfile?.marketingKeywords),
      },
      productionData: {
        readiness: "NOT_READY",
        readyReason: "",
        analysisCompleted,
        requiredAssetsPresent: originalAssets.length > 0,
        pathsValid: originalAssets.length > 0 && originalAssets.every((asset) => asset.fileAccessible),
      },
      intelligence,
      updatedAt: new Date().toISOString(),
    };
    this.refreshReadiness(product);
    await this.save(product);
    return product;
  }

  private applyAssetMap(product: CanonicalProduct): void {
    const assetMap = emptyAssetMap();
    for (const entry of product.productViews) {
      assetMap[entry.view] = [...(assetMap[entry.view] ?? []), entry.assetId];
    }
    product.assetMap = assetMap;
    if (product.intelligence) {
      product.intelligence.productViews = Object.fromEntries(
        CANONICAL_VIEWS
          .filter((view) => (assetMap[view] ?? []).length > 0)
          .map((view) => [view, assetMap[view]]),
      );
    }
  }

  private refreshReadiness(product: CanonicalProduct): void {
    const hasOriginals = product.originalAssets.length > 0;
    const pathsValid = hasOriginals && product.originalAssets.every((asset) => asset.fileAccessible);
    const idsValid = product.originalAssets.every((asset) => Boolean(asset.assetId));
    const anyFailed = product.originalAssets.some((asset) => asset.processingStatus === "FAILED");
    const analysisCompleted = product.productionData.analysisCompleted || product.productViews.length > 0;
    const structured = Boolean(product.intelligence);
    product.productionData.requiredAssetsPresent = hasOriginals;
    product.productionData.pathsValid = pathsValid;
    product.productionData.analysisCompleted = analysisCompleted;

    let readiness: ProductReadinessState = "NOT_READY";
    let reason = "Upload at least one original product image.";
    if (anyFailed && !pathsValid) {
      readiness = "FAILED";
      reason = "One or more original product files are missing or failed processing.";
    } else if (!hasOriginals) {
      readiness = "NOT_READY";
      reason = "No original product photographs are registered.";
    } else if (!pathsValid) {
      readiness = "FAILED";
      reason = "Original image files are registered but not accessible on disk.";
    } else if (!analysisCompleted || !structured) {
      readiness = "PARTIALLY_READY";
      reason = "Original images persist. Run product analysis to finish Product Intelligence.";
    } else if (hasOriginals && pathsValid && idsValid && analysisCompleted && structured) {
      readiness = "READY";
      reason = "Original assets persist, views are mapped, and Product Intelligence is ready for marketing and video production.";
    } else {
      readiness = "PARTIALLY_READY";
      reason = "Product data is incomplete for production.";
    }
    product.productionData.readiness = readiness;
    product.productionData.readyReason = reason;
  }

  private async toCanonicalAsset(
    project: CreativeProject,
    image: ProductImage,
    bucket: ReturnType<typeof classifyAssetBucket>,
    analyzed: boolean,
  ): Promise<CanonicalAsset> {
    const extension = storedExtension(image);
    const storedFileName = `${image.id}.${extension}`;
    const isVideo = bucket === "final" || image.mimeType.startsWith("video/");
    const originalRelativePath = `${isVideo ? "videos" : "images"}/${storedFileName}`;
    const productionUrl = isVideo
      ? `/api/workspace/projects/${project.id}/videos/${storedFileName}`
      : `/api/workspace/projects/${project.id}/images/${storedFileName}`;
    let fileAccessible = false;
    if (bucket === "original") {
      fileAccessible = Boolean(await this.workspace!.getOriginalImagePath(project.id, image.id));
    } else if (isVideo) {
      fileAccessible = Boolean(await this.workspace!.getVideoPath(project.id, storedFileName));
    } else {
      fileAccessible = Boolean(await this.workspace!.getImagePath(project.id, storedFileName));
    }

    let processingStatus: AssetLifecycleStatus = "UPLOADED";
    if (!fileAccessible && bucket === "original") processingStatus = "FAILED";
    else if (image.analysisState === "failed") processingStatus = "FAILED";
    else if (image.analysisState === "analyzing" || image.processingStatus === "processing") processingStatus = "PROCESSING";
    else if (analyzed || image.analysisState === "ready") processingStatus = fileAccessible ? "READY" : "ANALYZED";
    else if (fileAccessible) processingStatus = "UPLOADED";

    return {
      assetId: image.id,
      productId: project.id,
      originalFilename: image.sourceFileName ?? image.fileName,
      storedFileName,
      originalRelativePath,
      productionUrl,
      mimeType: image.mimeType,
      fileSize: image.sizeBytes,
      width: image.width ?? null,
      height: image.height ?? null,
      uploadedAt: image.uploadedAt,
      processingStatus,
      checksumSha256: image.checksumSha256,
      fileAccessible,
    };
  }

  private recordPath(projectId: string): string {
    return path.join(this.root, projectId, "product-record.json");
  }

  private async load(projectId: string): Promise<CanonicalProduct | null> {
    try {
      const raw = JSON.parse(await fs.readFile(this.recordPath(projectId), "utf8")) as CanonicalProduct;
      return raw?.version === 1 ? raw : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private async save(product: CanonicalProduct): Promise<void> {
    const target = this.recordPath(product.projectId);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(product, null, 2)}\n`, "utf8");
    await fs.rename(temporary, target);
  }

  private ensureReady(): void {
    if (!this.root || !this.workspace) throw new Error("Canonical Product Manager is not initialized");
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

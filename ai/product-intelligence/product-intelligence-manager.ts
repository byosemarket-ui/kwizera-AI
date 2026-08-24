import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, CreativeWorkspaceManager, ProductImage } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";
import type {
  AiMeProductIntelligenceAwareness,
  ImageAnalysisSummary,
  MissingProductInformation,
  PhotoRecommendation,
  ProductIntelligenceExplainResult,
  ProductIntelligenceHealthReport,
  ProductIntelligenceProfile,
  ProductIntelligenceStore,
  ProductViewAnalysis,
  ProductSellingPoint,
  ProductViewRole,
} from "./types.js";
import { detectViewRole, detectViewRoleDetailed, recommendedViewsForCategory } from "./view-role.js";

export { detectViewRole, detectViewRoleDetailed, recommendedViewsForCategory } from "./view-role.js";

const EMPTY: ProductIntelligenceStore = { profiles: [], history: [], cache: {}, logs: [] };
const MATERIALS: Array<[RegExp, string]> = [
  [/steel|metal|insulated|bottle|canister/i, "stainless steel"],
  [/glass/i, "glass"],
  [/wood|timber/i, "wood"],
  [/leather/i, "leather"],
  [/fabric|textile|cotton/i, "textile"],
  [/plastic|polymer/i, "polymer"],
];
const COLOURS: Array<[RegExp, string]> = [
  [/black|dark/i, "black"],
  [/white|clear/i, "white"],
  [/blue/i, "blue"],
  [/red/i, "red"],
  [/green/i, "green"],
  [/gold|yellow/i, "gold"],
];
const REQUIRED_ANGLES: ProductViewRole[] = ["front", "back", "left", "right", "top", "bottom"];
const DETAIL_ANGLES: ProductViewRole[] = ["detail", "close-up"];

/** Builds a durable digital product profile from workspace evidence; never modifies original images. */
export class ProductIntelligenceManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private workspace: CreativeWorkspaceManager | null = null;
  private imageIntelligence: ImageIntelligenceManager | null = null;
  private store: ProductIntelligenceStore = structuredClone(EMPTY);

  readonly identification = new ProductIdentificationEngine();
  readonly classification = new ProductClassificationEngine();
  readonly multiView = new MultiViewAnalysisEngine();
  readonly reconstruction = new ProductReconstructionEngine();
  readonly shape = new ProductShapeAnalyzer();
  readonly materials = new MaterialDetectionEngine();
  readonly texture = new TextureAnalysisEngine();
  readonly colour = new ColourIntelligenceEngine();
  readonly pattern = new ProductPatternAnalyzer();
  readonly style = new ProductStyleAnalyzer();
  readonly features = new ProductFeatureExtractor();
  readonly function = new ProductFunctionAnalyzer();
  readonly quality = new ProductQualityAnalyzer();
  readonly brand = new BrandRecognitionEngine();
  readonly logos = new VisibleLogoDetector();
  readonly sellingPoints = new SellingPointExtractor();
  readonly keywords = new MarketingKeywordEngine();
  readonly missing = new MissingInformationDetector();
  readonly photos = new PhotoRecommendationEngine();
  readonly relationships = new ProductRelationshipEngine();
  readonly decision = new ProductDecisionEngine();
  readonly metadata = new ProductMetadataManager();
  readonly history = new ProductHistoryManager(this);
  readonly cache = new ProductCacheManager();
  readonly validation = new ProductValidationManager();
  readonly analytics = new ProductAnalyticsManager(this);
  readonly health = new ProductIntelligenceHealthManager(this);

  async initialize(storageRoot: string, dependencies: { core: AiCoreManager; workspace: CreativeWorkspaceManager }): Promise<void> {
    this.root = path.join(storageRoot, "product-intelligence-runtime");
    this.core = dependencies.core;
    this.workspace = dependencies.workspace;
    await fs.mkdir(this.root, { recursive: true });
    this.store = await this.readStore();
    this.log("info", "Product intelligence runtime restored.");
    await this.persist();
  }

  isInitialized(): boolean {
    return Boolean(this.root);
  }

  attachImageIntelligence(manager: ImageIntelligenceManager): void {
    this.imageIntelligence = manager;
  }

  async analyze(projectId: string): Promise<ProductIntelligenceProfile> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");
    const check = this.validation.validate(project);
    if (!check.valid) throw new Error(check.issues.join(" "));
    const key = this.cache.key(project);
    const cachedId = this.store.cache[key];
    const cached = cachedId ? this.store.profiles.find((profile) => profile.id === cachedId) : undefined;
    if (cached) return { ...cached, cached: true };

    const imageProfiles = this.imageIntelligence ? await this.imageIntelligence.analyzeProject(projectId) : [];
    const profile = this.buildProfile(project, imageProfiles);
    this.store.profiles = this.store.profiles.filter((item) => item.projectId !== projectId);
    this.store.profiles.unshift(profile);
    this.store.cache[key] = profile.id;
    this.history.record(projectId, "analysis", `Built a ${profile.viewCount}-view digital product profile at ${profile.quality.score}/100.`);
    this.log("info", `Product profile analyzed for ${project.name}.`);
    await this.persist();
    return { ...profile };
  }

  /** Step 1 entry: analyze product + images and return the creative-pipeline product intelligence profile. */
  async analyzeProductIntelligence(projectId: string): Promise<ProductIntelligenceProfile> {
    return this.analyze(projectId);
  }

  async getProfile(projectId: string): Promise<ProductIntelligenceProfile | null> {
    this.ensureReady();
    return this.store.profiles.find((profile) => profile.projectId === projectId) ?? null;
  }

  async explainProduct(projectId: string): Promise<ProductIntelligenceExplainResult> {
    const profile = (await this.getProfile(projectId)) ?? (await this.analyze(projectId));
    const characteristics = [
      `Type: ${profile.productType}`,
      `Category: ${profile.category}`,
      `Brand: ${profile.brand}`,
      `Shape: ${profile.shapes.join(", ") || "not determined"}`,
      `Colour: ${profile.colours.join(", ") || "not determined"}`,
      `Materials: ${profile.materials.join(", ") || "not determined"}`,
      `Texture: ${profile.textures.join(", ") || "not determined"}`,
      `Pattern: ${profile.patterns.join(", ") || "not determined"}`,
      `Style: ${profile.style.join(", ") || "not determined"}`,
      profile.dimensions ? `Dimensions: ${profile.dimensions}` : "",
      `Views: ${profile.viewCount} (${profile.multiView.coverage})`,
      `Quality indicators: ${profile.qualityIndicators.join("; ") || "none recorded"}`,
      `Selling points: ${profile.sellingPoints.map((item) => item.point).join("; ") || "none recorded"}`,
    ].filter(Boolean);
    return {
      productId: profile.id,
      productName: profile.productName,
      summary: `${profile.identifiedAs}. Profile confidence ${profile.quality.confidence}/100. Original product images were not modified.`,
      characteristics,
      missingInformation: profile.missingInformation,
      photoRecommendations: profile.photoRecommendations,
      detailRecommendations: profile.detailRecommendations,
      readyForCreativeGeneration: profile.readyForCreativeGeneration,
    };
  }

  async detectMissingInformation(projectId: string): Promise<MissingProductInformation[]> {
    const profile = (await this.getProfile(projectId)) ?? (await this.analyze(projectId));
    return structuredClone(profile.missingInformation);
  }

  async recommendAdditionalPhotos(projectId: string): Promise<PhotoRecommendation[]> {
    const profile = (await this.getProfile(projectId)) ?? (await this.analyze(projectId));
    return structuredClone(profile.photoRecommendations);
  }

  async recommendMissingDetails(projectId: string): Promise<string[]> {
    const profile = (await this.getProfile(projectId)) ?? (await this.analyze(projectId));
    return [...profile.detailRecommendations];
  }

  getAiMeProductIntelligenceAwareness(): AiMeProductIntelligenceAwareness {
    const available = this.isInitialized();
    return {
      available,
      enabled: available,
      offlineFirst: true,
      canUnderstandProduct: available,
      canExplainCharacteristics: available,
      canDetectMissingInformation: available,
      canRecommendAdditionalPhotos: available,
      canRecommendMissingDetails: available,
      backgroundRemovalDeferred: true,
      videoGenerationDeferred: true,
      summary: available
        ? "AI Me Product Intelligence is online: understand products from user images and provided details, explain characteristics, detect gaps, and recommend photos/details. Background removal is owned by Product Asset Preparation (Step 2); video generation remains deferred."
        : "Product Intelligence runtime is not initialized.",
    };
  }

  async runHealthCheck(projectId?: string): Promise<ProductIntelligenceHealthReport> {
    return this.health.check(projectId);
  }

  async repair(projectId?: string): Promise<ProductIntelligenceHealthReport> {
    return this.health.repair(projectId);
  }

  async getDashboard(projectId?: string): Promise<{
    profiles: ProductIntelligenceProfile[];
    history: ProductIntelligenceStore["history"];
    logs: ProductIntelligenceStore["logs"];
    analytics: Record<string, number>;
    integrations: Record<string, boolean>;
    awareness: AiMeProductIntelligenceAwareness;
  }> {
    const profiles = this.store.profiles.filter((profile) => !projectId || profile.projectId === projectId);
    return {
      profiles: structuredClone(profiles),
      history: this.store.history.filter((item) => !projectId || item.projectId === projectId),
      logs: [...this.store.logs],
      analytics: this.analytics.summary(),
      integrations: {
        aiCore: Boolean(this.core),
        productIntelligenceFoundation: Boolean(this.core?.productIntelligenceFoundation),
        memoryFoundation: Boolean(this.core?.memoryFoundation),
        knowledgeFoundation: Boolean(this.core?.knowledgeFoundation),
        stateManager: Boolean(this.core?.stateManager),
        moduleManager: Boolean(this.core?.moduleManager),
        creativePipeline: Boolean(this.core?.workflowEngine),
        imageIntelligenceRuntime: Boolean(this.imageIntelligence?.isInitialized()),
        generationLayer: Boolean(this.core?.imageGenerationFoundation || this.core?.videoGenerationFoundation),
      },
      awareness: this.getAiMeProductIntelligenceAwareness(),
    };
  }

  async persist(): Promise<void> {
    await fs.writeFile(path.join(this.root, "profiles.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8");
  }

  log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.unshift({ at: new Date().toISOString(), level, message });
    this.store.logs.splice(100);
    this.core?.logger.info("product-intelligence", message);
  }

  private buildProfile(project: CreativeProject, imageProfiles: ImageIntelligenceProfile[]): ProductIntelligenceProfile {
    const evidence = evidenceText(project);
    const now = new Date().toISOString();
    const category = this.classification.classify(project);
    const productType = this.classification.productType(project, category);
    const userMaterials = project.productInformation.materials?.filter(Boolean) ?? [];
    const materials = unique([...userMaterials, ...this.materials.detect(evidence, category)].filter((item) => !item.includes("verification") || !userMaterials.length));
    const userColours = project.productInformation.colors?.filter(Boolean) ?? [];
    const colours = unique([...userColours, ...this.colour.detect(evidence, project.productImages.map((image) => image.fileName))]);
    const shapes = this.shape.analyze(evidence, category);
    const textures = this.texture.analyze(evidence, materials);
    const patterns = this.pattern.analyze(evidence);
    const style = this.style.analyze(evidence, category);
    const features = this.features.extract(project, materials);
    const functions = this.function.analyze(evidence, category);
    const view = this.multiView.analyze(project, imageProfiles);
    const brand = this.brand.recognize(project);
    const quality = this.quality.analyze(project, view, features, imageProfiles);
    const sellingPoints = this.sellingPoints.extract(project, features, materials, colours);
    const missingInformation = this.missing.detect(project, view, imageProfiles);
    const photoRecommendations = this.photos.recommend(view);
    const detailRecommendations = this.missing.detailRecommendations(missingInformation);
    const imageAnalysis = summarizeImageAnalysis(imageProfiles, view);
    const targetAudience = project.targetAudience.trim() || "audience requires confirmation";
    const marketingKeywords = this.keywords.extract(project, category, features, colours, materials);
    const dimensions = project.productInformation.specifications?.dimensions
      || project.productInformation.specifications?.size
      || undefined;
    const profile: ProductIntelligenceProfile = {
      id: randomUUID(),
      projectId: project.id,
      productName: project.productInformation.name,
      identifiedAs: this.identification.identify(project, category),
      productType,
      category,
      brand,
      description: project.productInformation.description,
      imageIds: project.productImages.map((image) => image.id),
      viewCount: view.viewCount,
      materials,
      colours: colours.filter((item) => !item.includes("verification") || !userColours.length),
      textures,
      shapes,
      patterns,
      style,
      features,
      functions,
      dimensions,
      visibleLogos: this.logos.detect(project, brand),
      qualityIndicators: quality.notes,
      sellingPoints,
      targetAudience,
      marketingKeywords,
      price: typeof project.productInformation.price === "number" ? project.productInformation.price : undefined,
      currency: project.productInformation.currency,
      sizes: project.productInformation.sizes ?? [],
      tags: project.productInformation.tags ?? [],
      specifications: { ...(project.productInformation.specifications ?? {}) },
      quality,
      relationships: this.relationships.detect(project, category, brand),
      multiView: view,
      imageAnalysis,
      missingInformation,
      photoRecommendations,
      detailRecommendations,
      readyForCreativeGeneration: this.decision.isReady(quality, missingInformation, view),
      originalImagesUnmodified: true,
      metadata: {
        ...this.metadata.create(project, view),
        imageIntelligenceProfiles: imageProfiles.length,
        averageImageQuality: imageAnalysis.averageQuality,
        imageComposition: imageProfiles[0]?.composition ?? "not analyzed",
        creativePipelineStep: 1,
        backgroundRemoval: "deferred",
        videoGeneration: "deferred",
      },
      createdAt: now,
      updatedAt: now,
      cached: false,
    };
    return this.reconstruction.reconstruct(profile);
  }

  private async readStore(): Promise<ProductIntelligenceStore> {
    try {
      const value = JSON.parse(await fs.readFile(path.join(this.root, "profiles.json"), "utf8")) as Partial<ProductIntelligenceStore>;
      return {
        ...structuredClone(EMPTY),
        ...value,
        profiles: (value.profiles ?? []).map(normalizeLegacyProfile),
        history: value.history ?? [],
        cache: value.cache ?? {},
        logs: value.logs ?? [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY);
      throw error;
    }
  }

  private ensureReady(): void {
    if (!this.root || !this.workspace) throw new Error("Product Intelligence Manager is not initialized");
  }
}

export class ProductIdentificationEngine {
  identify(project: CreativeProject, category: string): string {
    return `${project.productInformation.name || "Unlabeled product"} (${category})`;
  }
}

export class ProductClassificationEngine {
  classify(project: CreativeProject): string {
    const value = `${project.productInformation.category} ${project.productInformation.description}`.toLowerCase();
    if (/bottle|drink|beverage|cup|mug/.test(value)) return "Beverage container";
    if (/shoe|apparel|clothing|fashion/.test(value)) return "Apparel";
    if (/phone|device|electronic/.test(value)) return "Consumer electronics";
    if (/beauty|cosmetic|skincare/.test(value)) return "Beauty and personal care";
    return project.productInformation.category.trim() || "General consumer product";
  }

  productType(project: CreativeProject, category: string): string {
    const name = project.productInformation.name.toLowerCase();
    if (/bottle/.test(name) || /bottle/.test(project.productInformation.description)) return "bottle";
    if (/jacket|shirt|dress|shoe/.test(name)) return "apparel item";
    if (/serum|cream|lotion/.test(name)) return "beauty product";
    return category.toLowerCase().includes("general") ? "consumer product" : category.toLowerCase();
  }
}

export class MultiViewAnalysisEngine {
  analyze(project: CreativeProject, imageProfiles: ImageIntelligenceProfile[] = []): {
    viewCount: number;
    coverage: string;
    views: ProductViewAnalysis[];
    missingAngles: ProductViewRole[];
  } {
    const views = project.productImages.map((image) => {
      const profile = imageProfiles.find((item) => item.imageId === image.id);
      const role = (profile?.viewRole as ProductViewRole | undefined) || detectViewRole(image.fileName);
      return {
        imageId: image.id,
        fileName: image.fileName,
        role,
        duplicateOf: profile?.duplicateOfImageId,
      } satisfies ProductViewAnalysis;
    });
    const present = new Set(views.filter((view) => !view.duplicateOf).map((view) => view.role));
    if (present.has("left") || present.has("right")) present.add("side");
    if (present.has("close-up")) present.add("detail");
    const recommended = recommendedViewsForCategory(project.productInformation.category || project.productInformation.name || "");
    const missingAngles = recommended.filter((role) => !present.has(role) && !(role === "side" && (present.has("left") || present.has("right"))));
    const named = views.filter((view) => view.role !== "unknown").length;
    const coverage =
      views.length === 0
        ? "no-views"
        : named >= 4
          ? "multi-view-rich"
          : views.length > 1
            ? "multi-view"
            : "single-view";
    return { viewCount: project.productImages.length, coverage, views, missingAngles };
  }
}

export class ProductReconstructionEngine {
  reconstruct(profile: ProductIntelligenceProfile): ProductIntelligenceProfile {
    return {
      ...profile,
      metadata: {
        ...profile.metadata,
        reconstruction: profile.viewCount > 1 ? "multi-view product grouping" : "single-view product representation",
      },
    };
  }
}

export class ProductShapeAnalyzer {
  analyze(evidence: string, category: string): string[] {
    if (/bottle|container|cylinder/i.test(`${evidence} ${category}`)) return ["cylindrical", "vertical", "compact"];
    if (/box|package|rectangular/i.test(evidence)) return ["rectangular", "structured"];
    return ["product silhouette", "compact form"];
  }
}

export class MaterialDetectionEngine {
  detect(evidence: string, category: string): string[] {
    const matches = MATERIALS.filter(([pattern]) => pattern.test(`${evidence} ${category}`)).map(([, material]) => material);
    return matches.length ? unique(matches) : ["material requires visual-provider verification"];
  }
}

export class TextureAnalysisEngine {
  analyze(evidence: string, materials: string[]): string[] {
    if (/matte/i.test(evidence)) return ["matte"];
    if (/gloss|shiny/i.test(evidence)) return ["glossy"];
    if (materials.includes("stainless steel") || materials.includes("glass")) return ["smooth"];
    return ["surface texture requires visual-provider verification"];
  }
}

export class ColourIntelligenceEngine {
  detect(evidence: string, names: string[]): string[] {
    const matches = COLOURS.filter(([pattern]) => pattern.test(`${evidence} ${names.join(" ")}`)).map(([, colour]) => colour);
    return matches.length ? unique(matches) : ["colour requires visual-provider verification"];
  }
}

export class ProductPatternAnalyzer {
  analyze(evidence: string): string[] {
    if (/stripe|striped/i.test(evidence)) return ["striped"];
    if (/check|plaid/i.test(evidence)) return ["checked"];
    if (/floral/i.test(evidence)) return ["floral"];
    if (/solid|plain/i.test(evidence)) return ["solid"];
    return ["pattern not determined from provided evidence"];
  }
}

export class ProductStyleAnalyzer {
  analyze(evidence: string, category: string): string[] {
    if (/minimal|clean|modern/i.test(evidence)) return ["modern", "minimal"];
    if (/luxury|premium/i.test(evidence)) return ["premium"];
    if (/sport|athletic/i.test(evidence)) return ["athletic"];
    if (/Apparel|Beauty/i.test(category)) return ["lifestyle"];
    return ["style inferred from product category"];
  }
}

export class ProductFeatureExtractor {
  extract(project: CreativeProject, materials: string[]): string[] {
    const provided = project.productInformation.features ?? [];
    return unique([
      ...provided,
      project.productInformation.sku ? `SKU ${project.productInformation.sku}` : "",
      project.productImages.length > 1 ? "multi-angle reference set" : "single reference image",
      ...materials.filter((material) => !material.includes("verification")),
    ].filter(Boolean));
  }
}

export class ProductFunctionAnalyzer {
  analyze(evidence: string, category: string): string[] {
    if (/bottle|beverage container/i.test(`${evidence} ${category}`)) return ["stores beverages", "supports portable use"];
    if (/apparel/i.test(category)) return ["wearable product"];
    return ["function inferred from product category"];
  }
}

export class ProductQualityAnalyzer {
  analyze(
    project: CreativeProject,
    view: { viewCount: number; coverage: string },
    features: string[],
    imageProfiles: ImageIntelligenceProfile[],
  ): ProductIntelligenceProfile["quality"] {
    const avgImage = imageProfiles.length
      ? Math.round(imageProfiles.reduce((sum, item) => sum + item.quality.score, 0) / imageProfiles.length)
      : 0;
    const score = Math.min(
      98,
      58
        + Math.min(18, view.viewCount * 6)
        + (project.productInformation.description.length > 24 ? 8 : 0)
        + (project.brandInformation.name || project.productInformation.brand ? 6 : 0)
        + (features.length > 1 ? 4 : 0)
        + Math.min(10, Math.floor(avgImage / 15)),
    );
    return {
      score,
      confidence: Math.min(96, score - (view.viewCount === 1 ? 12 : 4)),
      notes: [
        view.viewCount > 1 ? "Multiple uploaded views were grouped as one product." : "Additional views would improve reconstruction confidence.",
        "Profile is derived from uploaded metadata and local evidence rules.",
        "Original product images were not modified.",
      ],
    };
  }
}

export class BrandRecognitionEngine {
  recognize(project: CreativeProject): string {
    return project.brandInformation.name.trim()
      || project.productInformation.brand?.trim()
      || "brand requires confirmation";
  }
}

export class VisibleLogoDetector {
  detect(project: CreativeProject, brand: string): string[] {
    const logos: string[] = [];
    if (brand && !brand.includes("requires")) logos.push(brand);
    for (const image of project.productImages) {
      if (/logo|brand|mark/i.test(image.fileName)) logos.push(`logo evidence in ${image.fileName}`);
    }
    return unique(logos);
  }
}

export class SellingPointExtractor {
  extract(project: CreativeProject, features: string[], materials: string[], colours: string[]): ProductSellingPoint[] {
    const points: ProductSellingPoint[] = [];
    for (const feature of project.productInformation.features ?? []) {
      points.push({ point: feature, source: "user-provided", confidence: 95 });
    }
    for (const material of materials.filter((item) => !item.includes("verification")).slice(0, 2)) {
      points.push({ point: `${material} construction`, source: "inferred-from-description", confidence: 72 });
    }
    for (const colour of colours.filter((item) => !item.includes("verification")).slice(0, 1)) {
      points.push({ point: `${colour} colourway`, source: "image-evidence", confidence: 68 });
    }
    if (project.productImages.length > 1) {
      points.push({ point: "multi-angle product documentation available", source: "image-evidence", confidence: 80 });
    }
    if (!points.length && features[0]) {
      points.push({ point: features[0], source: "inferred-from-description", confidence: 55 });
    }
    return uniqueBy(points, (item) => item.point);
  }
}

export class MarketingKeywordEngine {
  extract(project: CreativeProject, category: string, features: string[], colours: string[], materials: string[]): string[] {
    return unique([
      project.productInformation.name,
      category,
      project.brandInformation.name,
      ...colours.filter((item) => !item.includes("verification")),
      ...materials.filter((item) => !item.includes("verification")),
      ...features.slice(0, 4),
      ...(project.productInformation.tags ?? []),
      project.campaignInformation.objective,
    ].filter(Boolean).map((item) => String(item).toLowerCase()));
  }
}

export class MissingInformationDetector {
  detect(
    project: CreativeProject,
    view: { missingAngles: ProductViewRole[]; views: ProductViewAnalysis[] },
    imageProfiles: ImageIntelligenceProfile[],
  ): MissingProductInformation[] {
    const info = project.productInformation;
    const missing: MissingProductInformation[] = [];
    if (!info.brand?.trim() && !project.brandInformation.name.trim()) {
      missing.push({ field: "brand", severity: "recommended", recommendation: "Add the product brand for stronger brand-consistent creatives." });
    }
    if (!info.price && info.price !== 0) {
      missing.push({ field: "price", severity: "optional", recommendation: "Add price and currency if commercial messaging needs pricing." });
    }
    if (!info.currency?.trim() && typeof info.price === "number") {
      missing.push({ field: "currency", severity: "recommended", recommendation: "Add currency to accompany the provided price." });
    }
    if (!info.features?.length) {
      missing.push({ field: "features", severity: "recommended", recommendation: "List key product features from the real product, not invented claims." });
    }
    if (!info.materials?.length) {
      missing.push({ field: "materials", severity: "recommended", recommendation: "Confirm materials if they are known from packaging or specifications." });
    }
    if (!info.colors?.length) {
      missing.push({ field: "colors", severity: "optional", recommendation: "Confirm official colour names for catalogue accuracy." });
    }
    if (!info.sizes?.length && /apparel|fashion|clothing/i.test(`${info.category} ${info.description}`)) {
      missing.push({ field: "sizes", severity: "recommended", recommendation: "Add available sizes for apparel products." });
    }
    if (!info.specifications || !Object.keys(info.specifications).length) {
      missing.push({ field: "specifications", severity: "optional", recommendation: "Add specifications (dimensions, capacity, weight) when available." });
    }
    if (!project.targetAudience.trim()) {
      missing.push({ field: "targetAudience", severity: "recommended", recommendation: "Describe the intended audience before creative generation." });
    }
    if (view.missingAngles.includes("front")) {
      missing.push({ field: "frontViewImage", severity: "critical", recommendation: "Upload a clear front-view product photo." });
    }
    if (view.views.length < 2) {
      missing.push({ field: "additionalAngles", severity: "recommended", recommendation: "Upload additional angles (back, left/right, detail) for stronger product understanding." });
    }
    if (imageProfiles.some((profile) => profile.duplicateOfImageId)) {
      missing.push({ field: "uniqueImages", severity: "optional", recommendation: "Replace duplicate uploads with unique product angles." });
    }
    return missing;
  }

  detailRecommendations(missing: MissingProductInformation[]): string[] {
    return missing.map((item) => `${item.field}: ${item.recommendation}`);
  }
}

export class PhotoRecommendationEngine {
  recommend(view: { missingAngles: ProductViewRole[]; views: ProductViewAnalysis[] }): PhotoRecommendation[] {
    const priority = (role: ProductViewRole): PhotoRecommendation["priority"] =>
      role === "front" ? "high" : DETAIL_ANGLES.includes(role) ? "medium" : "high";
    const reason = (role: ProductViewRole): string => {
      if (role === "front") return "Front view anchors product identification and creative framing.";
      if (role === "back") return "Back view reveals labels, closures, and rear design details.";
      if (role === "left" || role === "right" || role === "side") return "Side views clarify product depth and silhouette.";
      if (role === "top") return "Top view helps communicate openings, lids, and packaging.";
      if (role === "bottom") return "Bottom view documents base markings and stability cues.";
      if (role === "detail" || role === "close-up") return "Detail/close-up photos capture texture, logos, and craftsmanship.";
      return "Additional named product angle improves multi-view coverage.";
    };
    const preferred = view.missingAngles.filter((role) => role !== "unknown").slice(0, 6);
    if (!view.views.length) {
      return [{ view: "front", reason: reason("front"), priority: "high" }];
    }
    return preferred.map((role) => ({ view: role, reason: reason(role), priority: priority(role) }));
  }
}

export class ProductRelationshipEngine {
  detect(project: CreativeProject, category: string, brand: string): ProductIntelligenceProfile["relationships"] {
    return [
      { type: "belongs-to-brand", target: brand, confidence: brand.includes("requires") ? 45 : 95 },
      { type: "classified-as", target: category, confidence: project.productInformation.category ? 88 : 55 },
      { type: "used-in-campaign", target: project.campaignInformation.name || "campaign requires confirmation", confidence: 85 },
    ];
  }
}

export class ProductDecisionEngine {
  recommend(profile: ProductIntelligenceProfile): string {
    return profile.readyForCreativeGeneration
      ? "Ready for generation context"
      : "Collect more product views or missing details before high-confidence generation";
  }

  isReady(
    quality: ProductIntelligenceProfile["quality"],
    missing: MissingProductInformation[],
    view: { viewCount: number },
  ): boolean {
    const critical = missing.some((item) => item.severity === "critical");
    return !critical && quality.confidence >= 70 && view.viewCount >= 1;
  }
}

export class ProductMetadataManager {
  create(project: CreativeProject, view: { viewCount: number; coverage: string }): Record<string, string | number | boolean> {
    return {
      provider: "local-product-profile-analyzer",
      imageCount: view.viewCount,
      viewCoverage: view.coverage,
      source: "creative-workspace",
      generatedAt: new Date().toISOString(),
      originalImagesUnmodified: true,
      productSku: project.productInformation.sku ?? "",
    };
  }
}

export class ProductHistoryManager {
  constructor(private readonly manager: ProductIntelligenceManager) {}
  record(projectId: string, event: string, detail: string): void {
    this.manager["store"].history.unshift({ id: randomUUID(), at: new Date().toISOString(), projectId, event, detail });
    this.manager["store"].history.splice(100);
  }
}

export class ProductCacheManager {
  key(project: CreativeProject): string {
    return createHash("sha256")
      .update(JSON.stringify({
        productInformation: project.productInformation,
        brandInformation: project.brandInformation,
        campaignInformation: project.campaignInformation,
        targetAudience: project.targetAudience,
        images: project.productImages.map((image) => [image.id, image.fileName, image.sizeBytes]),
      }))
      .digest("hex");
  }
}

export class ProductValidationManager {
  validate(project: CreativeProject): { valid: boolean; issues: string[] } {
    const issues = [
      !project.productInformation.name.trim() ? "Product name is required for analysis." : "",
      !project.productInformation.description.trim() ? "Product description is required for analysis." : "",
      !project.productImages.length ? "Upload at least one product image for analysis." : "",
    ].filter(Boolean);
    return { valid: !issues.length, issues };
  }
}

export class ProductAnalyticsManager {
  constructor(private readonly manager: ProductIntelligenceManager) {}
  summary(): Record<string, number> {
    const profiles = this.manager["store"].profiles;
    return {
      profiles: profiles.length,
      multiViewProfiles: profiles.filter((profile) => profile.viewCount > 1).length,
      averageQuality: profiles.length ? Math.round(profiles.reduce((sum, profile) => sum + profile.quality.score, 0) / profiles.length) : 0,
      averageConfidence: profiles.length ? Math.round(profiles.reduce((sum, profile) => sum + profile.quality.confidence, 0) / profiles.length) : 0,
      readyProfiles: profiles.filter((profile) => profile.readyForCreativeGeneration).length,
      cachedAnalyses: Object.keys(this.manager["store"].cache).length,
    };
  }
}

export class ProductIntelligenceHealthManager {
  constructor(private readonly manager: ProductIntelligenceManager) {}

  async check(projectId?: string): Promise<ProductIntelligenceHealthReport> {
    const checks: ProductIntelligenceHealthReport["checks"] = [];
    checks.push({
      name: "runtime-initialized",
      passed: this.manager.isInitialized(),
      detail: this.manager.isInitialized() ? "Product Intelligence runtime ready" : "Runtime not initialized",
    });
    const awareness = this.manager.getAiMeProductIntelligenceAwareness();
    checks.push({
      name: "ai-me-awareness",
      passed: awareness.available && awareness.canUnderstandProduct && awareness.backgroundRemovalDeferred,
      detail: awareness.summary,
    });
    if (projectId) {
      try {
        const profile = await this.manager.analyze(projectId);
        checks.push({
          name: "product-detection",
          passed: Boolean(profile.productName && profile.productType && profile.category),
          detail: `${profile.identifiedAs}`,
        });
        checks.push({
          name: "image-analysis",
          passed: profile.imageAnalysis.imageCount >= 1,
          detail: `${profile.imageAnalysis.imageCount} image(s); missing angles: ${profile.imageAnalysis.missingAngles.join(", ") || "none"}`,
        });
        checks.push({
          name: "product-profile-creation",
          passed: Boolean(profile.id && profile.sellingPoints && profile.marketingKeywords.length >= 0),
          detail: `profile ${profile.id}; keywords ${profile.marketingKeywords.length}; USP ${profile.sellingPoints.length}`,
        });
        checks.push({
          name: "metadata-generation",
          passed: Boolean(profile.metadata.provider && profile.originalImagesUnmodified),
          detail: `provider=${profile.metadata.provider}; unmodified=${profile.originalImagesUnmodified}`,
        });
        checks.push({
          name: "duplicate-detection",
          passed: Array.isArray(profile.imageAnalysis.duplicateImageIds),
          detail: `duplicates=${profile.imageAnalysis.duplicateImageIds.length}`,
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

  async repair(projectId?: string): Promise<ProductIntelligenceHealthReport> {
    const repaired: string[] = [];
    if (!this.manager.isInitialized()) {
      return {
        healthy: false,
        checks: [{ name: "runtime-initialized", passed: false, detail: "Cannot repair uninitialized runtime" }],
        repaired,
        criticalIssues: ["runtime-initialized"],
      };
    }
    await this.manager.persist();
    repaired.push("persisted-store");
    if (projectId) {
      const project = await this.manager["workspace"]!.getProject(projectId);
      if (project) {
        const key = this.manager.cache.key(project);
        delete this.manager["store"].cache[key];
        repaired.push("cleared-stale-cache");
        await this.manager.analyze(projectId);
        repaired.push("reanalyzed-product-profile");
      }
    }
    const report = await this.check(projectId);
    return { ...report, repaired };
  }
}

function summarizeImageAnalysis(
  imageProfiles: ImageIntelligenceProfile[],
  view: { views: ProductViewAnalysis[]; missingAngles: ProductViewRole[] },
): ImageAnalysisSummary {
  const duplicateImageIds = imageProfiles.filter((profile) => profile.duplicateOfImageId).map((profile) => profile.imageId);
  return {
    imageCount: imageProfiles.length || view.views.length,
    boundariesDetected: imageProfiles.filter((profile) => profile.boundaries?.detected).length,
    backgroundsClassified: imageProfiles.filter((profile) => profile.background && !profile.background.type.includes("requires")).length,
    shadowsNoted: imageProfiles.filter((profile) => profile.shadows && !profile.shadows.includes("requires")).length,
    reflectionsNoted: imageProfiles.filter((profile) => profile.reflections && !profile.reflections.includes("requires")).length,
    averageQuality: imageProfiles.length
      ? Math.round(imageProfiles.reduce((sum, item) => sum + item.quality.score, 0) / imageProfiles.length)
      : 0,
    resolutionNotes: imageProfiles.map((profile) => `${profile.fileName}: ${profile.resolution?.tier ?? "unknown"} (${profile.resolution?.notes ?? "n/a"})`),
    missingAngles: view.missingAngles,
    duplicateImageIds,
    viewCoverage: view.views,
  };
}

function evidenceText(project: CreativeProject): string {
  const info = project.productInformation;
  return [
    info.name,
    info.category,
    info.description,
    info.sku,
    info.brand,
    info.features?.join(" "),
    info.materials?.join(" "),
    info.colors?.join(" "),
    info.sizes?.join(" "),
    info.tags?.join(" "),
    info.specifications ? Object.entries(info.specifications).map(([key, value]) => `${key} ${value}`).join(" ") : "",
    project.brandInformation.name,
    project.brandInformation.guidelines,
    project.productImages.map((image: ProductImage) => image.fileName).join(" "),
  ].filter(Boolean).join(" ");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const token = key(value);
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

function normalizeLegacyProfile(profile: ProductIntelligenceProfile): ProductIntelligenceProfile {
  const views = profile.multiView?.views ?? profile.imageIds.map((imageId) => ({
    imageId,
    fileName: String(profile.metadata?.[`image:${imageId}`] ?? imageId),
    role: "unknown" as ProductViewRole,
  }));
  const missingAngles = profile.multiView?.missingAngles ?? REQUIRED_ANGLES.filter((role) => !views.some((view) => view.role === role));
  return {
    ...profile,
    productType: profile.productType ?? profile.category ?? "consumer product",
    description: profile.description ?? "",
    patterns: profile.patterns ?? [],
    style: profile.style ?? [],
    visibleLogos: profile.visibleLogos ?? [],
    qualityIndicators: profile.qualityIndicators ?? profile.quality?.notes ?? [],
    sellingPoints: profile.sellingPoints ?? [],
    targetAudience: profile.targetAudience ?? "",
    marketingKeywords: profile.marketingKeywords ?? [],
    sizes: profile.sizes ?? [],
    tags: profile.tags ?? [],
    specifications: profile.specifications ?? {},
    multiView: profile.multiView ?? {
      viewCount: profile.viewCount,
      coverage: String(profile.metadata?.viewCoverage ?? (profile.viewCount > 1 ? "multi-view" : "single-view")),
      views,
      missingAngles,
    },
    imageAnalysis: profile.imageAnalysis ?? {
      imageCount: profile.viewCount,
      boundariesDetected: 0,
      backgroundsClassified: 0,
      shadowsNoted: 0,
      reflectionsNoted: 0,
      averageQuality: Number(profile.metadata?.averageImageQuality ?? 0),
      resolutionNotes: [],
      missingAngles,
      duplicateImageIds: [],
      viewCoverage: views,
    },
    missingInformation: profile.missingInformation ?? [],
    photoRecommendations: profile.photoRecommendations ?? [],
    detailRecommendations: profile.detailRecommendations ?? [],
    readyForCreativeGeneration: profile.readyForCreativeGeneration ?? (profile.quality?.confidence ?? 0) >= 70,
    originalImagesUnmodified: true,
  };
}

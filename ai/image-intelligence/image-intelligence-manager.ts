import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, CreativeWorkspaceManager, ProductImage } from "../creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import { detectViewRole, detectViewRoleDetailed } from "../product-intelligence/view-role.js";
import { recordImageAnalysisFoundation } from "./analysis-bridge.js";
import { ensureThumbnailAsset } from "./image-ingest.js";
import type { ImageIntelligenceProfile, ImageIntelligenceStore, ObservationKind, VisualObservation } from "./types.js";
import type { VisionProvider } from "../ai-provider/vision-capabilities.js";
import { UnconfiguredVisionProvider } from "../ai-provider/vision-capabilities.js";
import { ANALYSIS_VERSION, computeVisualMetrics, type VisualMetrics } from "./visual-metrics.js";

const EMPTY: ImageIntelligenceStore = { profiles: [], history: [], cache: {}, logs: [] };

/** Persists local image evidence profiles; never modifies original product image bytes. */
export class ImageIntelligenceManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private workspace: CreativeWorkspaceManager | null = null;
  private store: ImageIntelligenceStore = structuredClone(EMPTY);
  private vision: VisionProvider = new UnconfiguredVisionProvider();

  readonly analysis = new ImageAnalysisEngine();
  readonly quality = new ImageQualityAnalyzer();
  readonly background = new BackgroundAnalysisEngine();
  readonly backgroundRemoval = new BackgroundRemovalAnalyzer();
  readonly boundary = new ProductBoundaryDetector();
  readonly resolution = new ImageResolutionAnalyzer();
  readonly lighting = new LightingAnalysisEngine();
  readonly shadow = new ShadowAnalysisEngine();
  readonly reflection = new ReflectionAnalysisEngine();
  readonly camera = new CameraAngleAnalyzer();
  readonly composition = new CompositionAnalyzer();
  readonly perspective = new PerspectiveAnalyzer();
  readonly objects = new ObjectDetectionEngine();
  readonly scene = new SceneUnderstandingEngine();
  readonly enhancement = new ImageEnhancementDecisionEngine();
  readonly defects = new ImageDefectDetectionEngine();
  readonly colorCues = new ColorCueEngine();
  readonly logoCues = new LogoCueEngine();
  readonly textCues = new TextCueEngine();
  readonly visibilityCues = new VisibilityCueEngine();
  readonly duplicates = new DuplicateImageDetector();
  readonly metadata = new ImageMetadataManager();
  readonly history = new ImageHistoryManager(this);
  readonly cache = new ImageCacheManager();
  readonly validation = new ImageValidationManager();
  readonly analytics = new ImageAnalyticsManager(this);

  async initialize(storageRoot: string, dependencies: { core: AiCoreManager; workspace: CreativeWorkspaceManager }): Promise<void> {
    this.root = path.join(storageRoot, "image-intelligence-runtime");
    this.core = dependencies.core;
    this.workspace = dependencies.workspace;
    await fs.mkdir(this.root, { recursive: true });
    this.store = await this.readStore();
    this.log("info", "Image intelligence runtime restored.");
    await this.persist();
  }

  isInitialized(): boolean {
    return Boolean(this.root);
  }

  setVisionProvider(provider: VisionProvider): void {
    this.vision = provider;
  }

  async analyzeProject(projectId: string): Promise<ImageIntelligenceProfile[]> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");
    const validation = this.validation.validate(project);
    if (!validation.valid) throw new Error(validation.issues.join(" "));
    const foundationKnowledgeIds = await this.retrieveFoundationKnowledge(project);
    const originals = project.productImages.filter(isOriginalProductImage);
    const profiles: ImageIntelligenceProfile[] = [];
    for (const image of originals) {
      profiles.push(await this.analyzeImage(project, image, foundationKnowledgeIds));
    }
    const marked = this.duplicates.mark(project, profiles);
    for (const profile of marked) {
      const index = this.store.profiles.findIndex((item) => item.imageId === profile.imageId);
      if (index >= 0) this.store.profiles[index] = profile;
    }
    await this.persist();
    return marked.map((profile) => ({ ...profile }));
  }

  async analyzeAsset(projectId: string, imageId: string): Promise<ImageIntelligenceProfile> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");
    const image = project.productImages.find((item) => item.id === imageId);
    if (!image) throw new Error("Image not found");
    if (!isOriginalProductImage(image)) throw new Error("Derived images are not analyzed as source assets");
    const foundationKnowledgeIds = await this.retrieveFoundationKnowledge(project);
    return this.analyzeImage(project, image, foundationKnowledgeIds);
  }

  async attachDerivedThumbnail(projectId: string, imageId: string, thumbnailId: string): Promise<void> {
    const index = this.store.profiles.findIndex((profile) => profile.projectId === projectId && profile.imageId === imageId);
    if (index < 0) return;
    this.store.profiles[index] = { ...this.store.profiles[index]!, derivedThumbnailId: thumbnailId };
    await this.persist();
  }

  async analyzeImage(
    project: CreativeProject,
    image: ProductImage,
    foundationKnowledgeIds: string[] = [],
  ): Promise<ImageIntelligenceProfile> {
    if (!isOriginalProductImage(image)) {
      throw new Error("Derived images are not analyzed as source assets");
    }
    const key = this.cache.key(project, image);
    const cachedId = this.store.cache[key];
    const cached = cachedId ? this.store.profiles.find((profile) => profile.id === cachedId) : undefined;
    if (cached?.analysisVersion === ANALYSIS_VERSION && cached.visualMetrics) {
      if (!cached.derivedThumbnailId) {
        const bytes = await this.readOriginalBytes(project.id, image.id);
        const ingest = await ensureThumbnailAsset(this.workspace!, project, image, bytes);
        if (ingest.thumbnailId) await this.attachDerivedThumbnail(project.id, image.id, ingest.thumbnailId);
      }
      return { ...cached, cached: true };
    }

    await this.workspace!.patchImage(project.id, image.id, { analysisState: "analyzing" }).catch(() => undefined);
    try {
      const bytes = await this.readOriginalBytes(project.id, image.id);
      const visual = computeVisualMetrics({
        bytes,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        sizeBytes: image.sizeBytes,
      });
      const previous = this.store.profiles.find((item) => item.imageId === image.id);
      const profile = this.buildProfile(project, image, foundationKnowledgeIds, visual, previous);
      await this.enrichWithVision(project, image, profile);
      const ingest = await ensureThumbnailAsset(this.workspace!, project, image, bytes);
      profile.derivedThumbnailId = ingest.thumbnailId;
      const foundation = await recordImageAnalysisFoundation(
        this.core,
        project,
        image,
        profile,
        this.store.profiles.filter((item) => item.projectId === project.id),
      );
      Object.assign(profile, foundation);
      this.store.profiles = this.store.profiles.filter((item) => item.imageId !== image.id);
      this.store.profiles.unshift(profile);
      this.store.cache[key] = profile.id;
      this.history.record(
        project.id,
        image.id,
        previous ? "analysis-superseded" : "analysis",
        `${previous ? `Superseded ${previous.id}. ` : ""}Analyzed ${image.fileName}: ${profile.quality.score}/100 (${ANALYSIS_VERSION}).`,
      );
      this.log("info", `Image intelligence profile created for ${image.fileName}.`);
      await this.persist();
      await this.workspace!.patchImage(project.id, image.id, { analysisState: "ready" }).catch(() => undefined);
      return { ...profile };
    } catch (error) {
      await this.workspace!.patchImage(project.id, image.id, { analysisState: "failed" }).catch(() => undefined);
      throw error;
    }
  }

  async getProfiles(projectId: string): Promise<ImageIntelligenceProfile[]> {
    return this.store.profiles.filter((profile) => profile.projectId === projectId).map((profile) => ({ ...profile }));
  }

  /** Manual view correction — analysis metadata only; never touches original image bytes. */
  async overrideViewRole(projectId: string, imageId: string, viewRole: string, confidence = 1): Promise<ImageIntelligenceProfile> {
    this.ensureReady();
    const index = this.store.profiles.findIndex((p) => p.projectId === projectId && p.imageId === imageId);
    if (index < 0) {
      const project = await this.workspace!.getProject(projectId);
      if (!project) throw new Error("Project not found");
      const image = project.productImages.find((item) => item.id === imageId);
      if (!image) throw new Error("Image not found");
      await this.analyzeImage(project, image);
    }
    const refreshed = this.store.profiles.findIndex((p) => p.projectId === projectId && p.imageId === imageId);
    if (refreshed < 0) throw new Error("Image profile not found");
    const current = this.store.profiles[refreshed]!;
    const updated: ImageIntelligenceProfile = {
      ...current,
      viewRole,
      metadata: {
        ...current.metadata,
        viewConfidence: Math.round(confidence * 100),
        userCorrected: 1,
        previousViewRole: current.viewRole,
      },
      updatedAt: new Date().toISOString(),
      cached: false,
    };
    this.store.profiles[refreshed] = updated;
    this.history.record(projectId, imageId, "user-correction", `View role set to ${viewRole} by user.`);
    await this.persist();
    return { ...updated };
  }

  async getDashboard(projectId?: string): Promise<{
    profiles: ImageIntelligenceProfile[];
    history: ImageIntelligenceStore["history"];
    logs: ImageIntelligenceStore["logs"];
    analytics: Record<string, number>;
    integrations: Record<string, boolean>;
  }> {
    const profiles = this.store.profiles.filter((profile) => !projectId || profile.projectId === projectId);
    return {
      profiles: structuredClone(profiles),
      history: this.store.history.filter((item) => !projectId || item.projectId === projectId),
      logs: [...this.store.logs],
      analytics: this.analytics.summary(),
      integrations: {
        aiCore: Boolean(this.core),
        imageIntelligenceFoundation: Boolean(this.core?.imageIntelligenceFoundation),
        productIntelligenceFoundation: Boolean(this.core?.productIntelligenceFoundation),
        memoryFoundation: Boolean(this.core?.memoryFoundation),
        knowledgeFoundation: Boolean(this.core?.knowledgeFoundation),
        stateManager: Boolean(this.core?.stateManager),
        moduleManager: Boolean(this.core?.moduleManager),
        creativePipeline: Boolean(this.core?.workflowEngine),
        generationLayer: Boolean(this.core?.imageGenerationFoundation || this.core?.videoGenerationFoundation),
      },
    };
  }

  async persist(): Promise<void> {
    await fs.writeFile(path.join(this.root, "profiles.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8");
  }

  log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.unshift({ at: new Date().toISOString(), level, message });
    this.store.logs.splice(100);
    this.core?.logger.info("image-intelligence", message);
  }

  private async retrieveFoundationKnowledge(project: CreativeProject): Promise<string[]> {
    const { retrieveFoundationKnowledgeForProject } = await import("../knowledge-foundation/knowledge-teaching-service.js");
    return retrieveFoundationKnowledgeForProject(
      this.core?.knowledgeFoundation,
      project,
      "image-intelligence-manager",
      ["image", "lighting", "composition"],
    );
  }

  private buildProfile(
    project: CreativeProject,
    image: ProductImage,
    foundationKnowledgeIds: string[] = [],
    visual: VisualMetrics,
    previous?: ImageIntelligenceProfile,
  ): ImageIntelligenceProfile {
    const evidence = `${project.productInformation.name} ${project.productInformation.description} ${image.fileName} ${(project.productInformation.colors ?? []).join(" ")}`;
    const quality = this.quality.analyze(image, visual);
    quality.classification =
      quality.score >= 85 ? "GOOD"
        : quality.score >= 72 ? "ACCEPTABLE"
          : quality.score >= 55 ? "NEEDS_REVIEW"
            : "POOR";
    const background = this.background.analyze(evidence, visual);
    const objects = this.objects.detect(project, image);
    const detection = detectViewRoleDetailed(image.fileName);
    const userCorrected = previous?.metadata?.userCorrected === 1 && Boolean(previous.viewRole);
    const viewRole = userCorrected ? previous!.viewRole : detection.role;
    const viewConfidence = userCorrected ? 100 : Math.round(detection.confidence * 100);
    const boundaries = this.boundary.detect(background, evidence, visual);
    const resolution = this.resolution.analyze(image, visual);
    const defects = this.defects.detect(image, quality, resolution);
    const heuristicColors = this.colorCues.detect(evidence, project.productInformation.colors ?? []);
    const pixelColors = (visual.dominantColors ?? []).map((color, index) => ({
      name: color.name,
      role: (index === 0 ? "primary" : index === 1 ? "secondary" : "accent") as "primary" | "secondary" | "accent",
      confidence: Math.min(0.92, 0.62 + color.share * 0.3),
      kind: "observed-from-image" as ObservationKind,
    }));
    const colors = [
      ...pixelColors,
      ...heuristicColors.filter((color) => !pixelColors.some((pixel) => pixel.name.toLowerCase() === color.name.toLowerCase())),
    ].slice(0, 5);
    const logo = this.logoCues.detect(evidence, project.productInformation.brand ?? project.brandInformation.name, viewRole);
    const detectedText = this.textCues.detect(
      image.fileName,
      project.productInformation.name,
      project.productInformation.brand ?? project.brandInformation.name,
      project.productInformation.sku,
    );
    const visibility = this.visibilityCues.analyze(image, defects, quality);
    const lightingHeuristic = this.lighting.analyze(evidence);
    const lighting = visual.pixelAnalysisAvailable && visual.lightingObserved
      ? `${visual.lightingObserved}; ${lightingHeuristic}`
      : lightingHeuristic;
    const observations = this.collectObservations(project, image, visual, viewRole, userCorrected ? 1 : detection.confidence, objects, colors);
    const profile: ImageIntelligenceProfile = {
      id: randomUUID(),
      projectId: project.id,
      imageId: image.id,
      fileName: image.fileName,
      mimeType: image.mimeType,
      quality,
      background,
      boundaries,
      resolution,
      viewRole,
      lighting,
      shadows: this.shadow.analyze(evidence),
      reflections: this.reflection.analyze(evidence),
      cameraAngle: this.camera.analyze(evidence, viewRole),
      composition: visual.pixelAnalysisAvailable
        ? `${visual.cleanlinessObserved ?? "composition observed from pixels"}; ${this.composition.analyze(evidence)}`
        : this.composition.analyze(evidence),
      perspective: this.perspective.analyze(evidence, viewRole),
      objects,
      scene: this.scene.understand(project, objects, background),
      defects,
      enhancements: [],
      colors,
      logo,
      detectedText,
      visibility,
      metadata: {
        ...this.metadata.create(image),
        originalImageUnmodified: 1,
        backgroundRemovalDeferred: 1,
        viewConfidence,
        userCorrected: userCorrected ? 1 : 0,
        previousViewRole: userCorrected ? String(previous?.metadata?.previousViewRole ?? "") : "",
        primaryColor: colors[0]?.name ?? "",
        logoPresent: logo.present ? 1 : 0,
        visibilityPercent: visibility.percent,
        qualityClass: quality.classification ?? "ACCEPTABLE",
        analysisVersion: ANALYSIS_VERSION,
        pixelAnalysisAvailable: visual.pixelAnalysisAvailable ? 1 : 0,
        aiVisionStatus: "IMAGE_ANALYSIS_UNAVAILABLE",
      },
      foundationKnowledgeIds: foundationKnowledgeIds.length ? foundationKnowledgeIds : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cached: false,
      analysisVersion: ANALYSIS_VERSION,
      analysisState: "ready",
      processingState: "ready",
      aiVisionStatus: "IMAGE_ANALYSIS_UNAVAILABLE",
      visualMetrics: visual,
      provenance: {
        sourceAssetId: image.id,
        analysisType: "image-intelligence",
        analysisVersion: ANALYSIS_VERSION,
        provider: visual.provider,
        model: null,
        timestamp: new Date().toISOString(),
        originalChecksumSha256: image.checksumSha256,
        previousProfileId: previous?.id,
      },
      observations,
    };
    profile.enhancements = this.enhancement.recommend(profile);
    return this.analysis.finalize(profile);
  }

  private async enrichWithVision(
    project: CreativeProject,
    image: ProductImage,
    profile: ImageIntelligenceProfile,
  ): Promise<void> {
    try {
      if (!(await this.vision.isAvailable())) return;
      let imageBase64: string | undefined;
      try {
        const imagePath = await this.workspace?.getOriginalImagePath(project.id, image.id);
        if (imagePath) {
          const bytes = await fs.readFile(imagePath);
          // Cap payload size for local vision models on small hosts.
          if (bytes.byteLength > 0 && bytes.byteLength <= 2_500_000) {
            imageBase64 = bytes.toString("base64");
          }
        }
      } catch {
        imageBase64 = undefined;
      }
      const vision = await this.vision.analyzeImage({
        projectId: project.id,
        assetId: image.id,
        mimeType: image.mimeType,
        fileName: image.fileName,
        userProductName: project.productInformation?.name,
        userCategory: project.productInformation?.category,
        imageBase64,
      });
      if (!vision.available) return;

      profile.aiVisionStatus = "completed";
      profile.provenance = {
        ...profile.provenance!,
        provider: vision.provider,
        model: vision.model,
      };
      profile.metadata = {
        ...profile.metadata,
        aiVisionStatus: "completed",
        aiVisionProvider: vision.provider,
      };

      const viewGuess = vision.views?.[0];
      if (viewGuess && viewGuess.confidence >= 0.55 && profile.metadata.userCorrected !== 1) {
        profile.viewRole = viewGuess.view;
        profile.metadata.viewConfidence = Math.round(viewGuess.confidence * 100);
      }
      if (vision.backgroundType && vision.backgroundType.confidence >= 0.5) {
        profile.background = {
          ...profile.background,
          type: vision.backgroundType.type,
          confidence: Math.max(profile.background.confidence, vision.backgroundType.confidence),
        };
      }
      if (vision.dominantColors?.length) {
        profile.colors = [
          ...vision.dominantColors.map((color) => ({
            name: color.name,
            role: "primary" as const,
            confidence: color.confidence,
            kind: "observed-from-image" as ObservationKind,
          })),
          ...(profile.colors ?? []),
        ].slice(0, 5);
      }
    } catch {
      profile.aiVisionStatus = profile.aiVisionStatus ?? "IMAGE_ANALYSIS_UNAVAILABLE";
    }
  }

  private collectObservations(
    project: CreativeProject,
    image: ProductImage,
    visual: VisualMetrics,
    viewRole: string,
    viewConfidence: number,
    objects: ImageIntelligenceProfile["objects"],
    colors: NonNullable<ImageIntelligenceProfile["colors"]>,
  ): VisualObservation[] {
    const observations: VisualObservation[] = [
      { field: "mimeType", value: image.mimeType, kind: "observed-from-image", confidence: 1 },
      { field: "sizeBytes", value: String(image.sizeBytes), kind: "observed-from-image", confidence: 1 },
    ];
    if (visual.width && visual.height) {
      observations.push({
        field: "dimensions",
        value: `${visual.width}x${visual.height}`,
        kind: "observed-from-image",
        confidence: visual.pixelAnalysisAvailable ? 0.99 : 0.9,
      });
    }
    if (visual.aspectRatio) {
      observations.push({ field: "aspectRatio", value: String(visual.aspectRatio), kind: "observed-from-image", confidence: 0.99 });
    }
    if (visual.backgroundObserved && visual.backgroundObserved !== "unavailable") {
      observations.push({ field: "background", value: visual.backgroundObserved, kind: "observed-from-image", confidence: visual.borderUniformity ?? 0.5 });
    }
    if (visual.lightingObserved && visual.pixelAnalysisAvailable) {
      observations.push({ field: "lighting", value: visual.lightingObserved, kind: "observed-from-image", confidence: 0.7 });
    }
    for (const color of colors.filter((color) => color.kind === "observed-from-image")) {
      observations.push({ field: "color", value: color.name, kind: "observed-from-image", confidence: color.confidence });
    }
    observations.push({
      field: "viewRole",
      value: viewRole,
      kind: "inferred",
      confidence: viewConfidence,
    });
    for (const object of objects.filter((object) => object.kind === "inferred")) {
      observations.push({ field: "object", value: object.label, kind: "inferred", confidence: object.confidence / 100 });
    }
    if (project.productInformation.name) {
      observations.push({
        field: "productName",
        value: project.productInformation.name,
        kind: "user-provided",
        confidence: 1,
      });
    }
    if (project.productInformation.category) {
      observations.push({
        field: "productCategory",
        value: project.productInformation.category,
        kind: "user-provided",
        confidence: 1,
      });
    }
    observations.push({
      field: "aiVision",
      value: "IMAGE_ANALYSIS_UNAVAILABLE",
      kind: "inferred",
      confidence: 1,
    });
    return observations;
  }

  private async readOriginalBytes(projectId: string, imageId: string): Promise<Buffer | null> {
    try {
      const originalPath = await this.workspace!.getOriginalImagePath(projectId, imageId);
      if (!originalPath) return null;
      return await fs.readFile(originalPath);
    } catch {
      return null;
    }
  }

  private async readStore(): Promise<ImageIntelligenceStore> {
    try {
      const value = JSON.parse(await fs.readFile(path.join(this.root, "profiles.json"), "utf8")) as Partial<ImageIntelligenceStore>;
      return {
        ...structuredClone(EMPTY),
        ...value,
        profiles: (value.profiles ?? []).map(normalizeLegacyImageProfile),
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
    if (!this.root || !this.workspace) throw new Error("Image Intelligence Manager is not initialized");
  }
}

export class ImageAnalysisEngine {
  finalize(profile: ImageIntelligenceProfile): ImageIntelligenceProfile {
    return {
      ...profile,
      metadata: {
        ...profile.metadata,
        provider: profile.visualMetrics?.provider ?? "local-image-evidence-analyzer",
        aiVisionStatus: "IMAGE_ANALYSIS_UNAVAILABLE",
      },
    };
  }
}

export class ImageQualityAnalyzer {
  analyze(image: ProductImage, visual?: VisualMetrics): ImageIntelligenceProfile["quality"] {
    const width = visual?.width ?? image.width;
    const height = visual?.height ?? image.height;
    const pixels = (width ?? 0) * (height ?? 0);
    const dimScore = pixels >= 2_000_000 ? 24 : pixels >= 300_000 ? 16 : pixels >= 10_000 ? 10 : pixels >= 1 ? 4 : 0;
    const sizeScore = image.sizeBytes > 100_000 ? 20 : image.sizeBytes > 10_000 ? 14 : 7;
    const score = Math.min(94, 50 + dimScore + sizeScore + (image.mimeType === "image/png" ? 8 : 5));
    return {
      score,
      confidence: Math.min(88, score - 8),
      notes: [
        pixels
          ? `Quality uses measured ${width}×${height} (${visual?.method ?? "header"}).`
          : "Quality is assessed from file metadata; pixel dimensions were not available.",
        image.sizeBytes < 10_000 ? "Small source file may limit detail retention." : "Source file size supports standard creative use.",
        "Original image bytes were not modified.",
        "AI vision is not configured — this is not a model-generated product description.",
      ],
    };
  }
}

export class BackgroundAnalysisEngine {
  analyze(evidence: string, visual?: VisualMetrics): ImageIntelligenceProfile["background"] {
    if (/transparent|cutout|png.?alpha/i.test(evidence)) {
      return { type: "Transparent", removable: false, confidence: 78, complexity: "low", separation: "Excellent", removalSuitability: "high" };
    }
    if (/white|studio|plain|isolated|seamless/i.test(evidence)) {
      return { type: "White Studio", removable: true, confidence: 82, complexity: "low", separation: "Excellent", removalSuitability: "high" };
    }
    if (/black.?bg|dark.?studio/i.test(evidence)) {
      return { type: "Black", removable: true, confidence: 76, complexity: "low", separation: "Good", removalSuitability: "high" };
    }
    if (/gray|grey|neutral/i.test(evidence)) {
      return { type: "Neutral", removable: true, confidence: 72, complexity: "low", separation: "Good", removalSuitability: "high" };
    }
    if (/gradient/i.test(evidence)) {
      return { type: "Gradient", removable: true, confidence: 68, complexity: "medium", separation: "Fair", removalSuitability: "medium" };
    }
    if (/outdoor|street|nature|lifestyle/i.test(evidence)) {
      return { type: "Outdoor", removable: true, confidence: 70, complexity: "high", separation: "Fair", removalSuitability: "medium" };
    }
    if (/indoor|room|interior/i.test(evidence)) {
      return { type: "Indoor", removable: true, confidence: 66, complexity: "medium", separation: "Fair", removalSuitability: "medium" };
    }
    if (/complex|busy|clutter/i.test(evidence)) {
      return { type: "Complex", removable: false, confidence: 58, complexity: "high", separation: "Poor", removalSuitability: "low" };
    }
    if (visual?.backgroundObserved === "uniform-light") {
      return { type: "White Studio", removable: true, confidence: 64, complexity: "low", separation: "Good", removalSuitability: "high" };
    }
    if (visual?.backgroundObserved === "uniform-dark") {
      return { type: "Black", removable: true, confidence: 60, complexity: "low", separation: "Good", removalSuitability: "high" };
    }
    return {
      type: "Unknown",
      removable: false,
      confidence: 38,
      complexity: "unknown",
      separation: "Unknown",
      removalSuitability: "unknown",
    };
  }
}

const COLOR_CUES: Array<[RegExp, string]> = [
  [/black|noir|dark/i, "Black"],
  [/white|ivory|cream/i, "White"],
  [/red|crimson|scarlet/i, "Red"],
  [/blue|navy|azure/i, "Blue"],
  [/green|olive|emerald/i, "Green"],
  [/brown|tan|beige|khaki/i, "Brown"],
  [/gray|grey|silver/i, "Gray"],
  [/gold|yellow/i, "Gold"],
  [/pink|rose/i, "Pink"],
  [/orange/i, "Orange"],
  [/purple|violet/i, "Purple"],
];

/** Filename/description color cues — not pixel sampling. */
export class ColorCueEngine {
  detect(evidence: string, userColors: string[] = []): ImageIntelligenceProfile["colors"] {
    const found: ImageIntelligenceProfile["colors"] = [];
    for (const [pattern, name] of COLOR_CUES) {
      if (pattern.test(evidence) && !found.some((c) => c.name === name)) {
        found.push({
          name,
          role: found.length === 0 ? "primary" : found.length === 1 ? "secondary" : "accent",
          confidence: 0.72 + Math.min(0.2, found.length * 0.02),
          kind: "inferred",
        });
      }
    }
    for (const color of userColors) {
      const name = color.trim();
      if (!name || found.some((c) => c.name.toLowerCase() === name.toLowerCase())) continue;
      found.push({
        name,
        role: found.length === 0 ? "primary" : "secondary",
        confidence: 0.55,
        kind: "user-provided",
      });
    }
    return found.slice(0, 5);
  }
}

export class LogoCueEngine {
  detect(evidence: string, brand: string, viewRole: string): NonNullable<ImageIntelligenceProfile["logo"]> {
    const logoNamed = /\blogo\b|wordmark|brand[-_ ]?mark/i.test(evidence) || viewRole === "logo";
    const brandHint = brand && !/requires|unknown|not determined/i.test(brand) ? brand : undefined;
    if (logoNamed || brandHint) {
      return {
        present: logoNamed || Boolean(brandHint),
        possibleBrand: brandHint,
        location: logoNamed ? "Logo-oriented view or filename evidence" : "Brand context from product data",
        confidence: logoNamed ? 0.9 : brandHint ? 0.62 : 0.35,
      };
    }
    return { present: false, confidence: 0.4, location: "No visible logo evidence in filename/view role" };
  }
}

export class TextCueEngine {
  detect(fileName: string, productName: string, brand: string, sku?: string): NonNullable<ImageIntelligenceProfile["detectedText"]> {
    const out: NonNullable<ImageIntelligenceProfile["detectedText"]> = [];
    const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    if (brand && new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(`${fileName} ${base}`)) {
      out.push({ text: brand, kind: "brand", confidence: 0.78 });
    }
    if (productName && productName.length > 2 && new RegExp(productName.split(/\s+/)[0]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(base)) {
      out.push({ text: productName, kind: "label", confidence: 0.65 });
    }
    if (sku && new RegExp(sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(fileName)) {
      out.push({ text: sku, kind: "model", confidence: 0.8 });
    }
    const modelMatch = base.match(/\b([A-Z]{1,4}[-_]?\d{2,6}[A-Z]?)\b/);
    if (modelMatch) out.push({ text: modelMatch[1]!, kind: "model", confidence: 0.58 });
    return out.slice(0, 6);
  }
}

export class VisibilityCueEngine {
  analyze(
    image: ProductImage,
    defects: string[],
    quality: ImageIntelligenceProfile["quality"],
  ): NonNullable<ImageIntelligenceProfile["visibility"]> {
    const text = defects.join(" ").toLowerCase();
    const cutoff = /cut.?off|cropped|clipped|edge/i.test(text);
    const small = /small|tiny|distant/i.test(text) || image.sizeBytes < 10_000;
    const obstruct = /obstruct|hidden|partial|cover/i.test(text);
    let percent = 90;
    if (cutoff) percent -= 25;
    if (small) percent -= 20;
    if (obstruct) percent -= 15;
    if (quality.score < 70) percent -= 10;
    percent = Math.max(25, Math.min(98, percent));
    const status =
      percent >= 85 && !cutoff ? "good"
        : percent >= 70 ? "acceptable"
          : percent >= 50 ? "needs-review"
            : "poor";
    return {
      percent,
      framing: cutoff ? "Too close to edge / cut-off risk" : small ? "Product may be small in frame" : "Good",
      cutoff,
      obstruction: obstruct ? "Possible obstruction" : "Low",
      status,
      confidence: Math.min(0.88, 0.5 + quality.confidence / 200),
    };
  }
}

export class BackgroundRemovalAnalyzer {
  analyze(background: ImageIntelligenceProfile["background"]): string {
    return background.removable
      ? "Background separation suitable for Product Asset Preparation (Step 2)."
      : "Confirm subject boundary carefully before Product Asset Preparation cutout.";
  }

  /** Structured removal plan consumed by the Product Asset Preparation runtime. */
  plan(profile: ImageIntelligenceProfile): {
    removable: boolean;
    preserveEdges: boolean;
    preserveShadows: boolean;
    preserveReflections: boolean;
    confidence: number;
    notes: string[];
  } {
    const preserveReflections = /reflect|steel|glass|metal/i.test(`${profile.reflections} ${profile.fileName}`);
    const preserveShadows = /shadow/i.test(profile.shadows) || profile.background.removable;
    return {
      removable: profile.background.removable || profile.boundaries.detected,
      preserveEdges: true,
      preserveShadows,
      preserveReflections,
      confidence: Math.min(95, Math.round((profile.background.confidence + profile.boundaries.confidence) / 2)),
      notes: [
        this.analyze(profile.background),
        "Processed cutouts must be stored separately from original uploads.",
      ],
    };
  }
}

export class ProductBoundaryDetector {
  detect(background: ImageIntelligenceProfile["background"], evidence: string, visual?: VisualMetrics): ImageIntelligenceProfile["boundaries"] {
    if (visual?.pixelAnalysisAvailable && (visual.borderUniformity ?? 0) >= 0.8) {
      return {
        detected: true,
        confidence: Math.min(82, Math.round(50 + (visual.borderUniformity ?? 0) * 40)),
        notes: "Product/background separation observed from border uniformity. No mask was written to disk.",
      };
    }
    if (background.removable) {
      return {
        detected: true,
        confidence: Math.min(85, background.confidence + 8),
        notes: "Product boundary inferred from separable background context. No mask was written to disk.",
      };
    }
    if (/product|bottle|pack|item/i.test(evidence)) {
      return {
        detected: true,
        confidence: 55,
        notes: "Primary product subject inferred from naming/description; boundary confidence limited without pixel vision.",
      };
    }
    return {
      detected: false,
      confidence: 30,
      notes: "Product boundary requires visual-provider verification.",
    };
  }
}

export class ImageResolutionAnalyzer {
  analyze(image: ProductImage, visual?: VisualMetrics): ImageIntelligenceProfile["resolution"] {
    const width = visual?.width ?? image.width;
    const height = visual?.height ?? image.height;
    const pixels = (width ?? 0) * (height ?? 0);
    const estimatedFromBytes = Math.max(0.05, Number((image.sizeBytes / 180_000).toFixed(2)));
    const tier = pixels
      ? pixels >= 2_000_000 ? "high" : pixels >= 300_000 ? "standard" : "low"
      : image.sizeBytes < 10_000 ? "low" : image.sizeBytes < 250_000 ? "standard" : "high";
    return {
      tier,
      estimatedFromBytes,
      notes: width && height
        ? `Measured ${width}×${height} from ${visual?.method ?? "image header"} (${image.sizeBytes} bytes).`
        : `Resolution tier ${tier} estimated from ${image.sizeBytes} source bytes (not pixel-decoded).`,
    };
  }
}

export class LightingAnalysisEngine {
  analyze(evidence: string): string {
    if (/studio|bright|light/i.test(evidence)) return "controlled or bright lighting inferred from context";
    if (/dark|night/i.test(evidence)) return "low-light context inferred";
    return "lighting requires visual-provider verification";
  }
}

export class ShadowAnalysisEngine {
  analyze(evidence: string): string {
    return /shadow/i.test(evidence) ? "shadow mentioned in source evidence" : "shadow requires visual-provider verification";
  }
}

export class ReflectionAnalysisEngine {
  analyze(evidence: string): string {
    return /glass|steel|metal|reflect/i.test(evidence)
      ? "reflective material may create highlights"
      : "reflection requires visual-provider verification";
  }
}

export class CameraAngleAnalyzer {
  analyze(evidence: string, viewRole?: string): string {
    if (viewRole && viewRole !== "unknown") return `${viewRole} product view`;
    if (/front/i.test(evidence)) return "front product view";
    if (/back|rear/i.test(evidence)) return "back product view";
    if (/left/i.test(evidence)) return "left product view";
    if (/right/i.test(evidence)) return "right product view";
    if (/side/i.test(evidence)) return "side product view";
    if (/top|overhead/i.test(evidence)) return "top-down view";
    if (/bottom/i.test(evidence)) return "bottom product view";
    if (/detail|close[-_ ]?up/i.test(evidence)) return "detail product view";
    return "camera angle requires visual-provider verification";
  }
}

export class CompositionAnalyzer {
  analyze(evidence: string): string {
    return /studio|product/i.test(evidence) ? "product-focused composition inferred" : "composition requires visual-provider verification";
  }
}

export class PerspectiveAnalyzer {
  analyze(evidence: string, viewRole?: string): string {
    if (viewRole && viewRole !== "unknown") return `perspective inferred from ${viewRole} view role`;
    return /front|side|top|overhead|back|detail/i.test(evidence)
      ? "perspective inferred from image naming"
      : "perspective requires visual-provider verification";
  }
}

export class ObjectDetectionEngine {
  detect(project: CreativeProject, image: ProductImage): ImageIntelligenceProfile["objects"] {
    const objects: ImageIntelligenceProfile["objects"] = [];
    if (project.productInformation.name) {
      objects.push({ label: project.productInformation.name, confidence: 90, kind: "user-provided" });
    } else {
      objects.push({ label: "primary product", confidence: 40, kind: "inferred" });
    }
    if (image.fileName.toLowerCase().includes("bottle")) {
      objects.push({ label: "bottle", confidence: 62, kind: "inferred" });
    }
    return objects;
  }
}

export class SceneUnderstandingEngine {
  understand(
    project: CreativeProject,
    objects: ImageIntelligenceProfile["objects"],
    background: ImageIntelligenceProfile["background"],
  ): string {
    return `${project.productInformation.name || objects[0]?.label || "Product"} in ${background.type}; ${objects.length} object label(s) recorded.`;
  }
}

export class ImageEnhancementDecisionEngine {
  recommend(profile: ImageIntelligenceProfile): string[] {
    return unique([
      profile.quality.score < 75 ? "Use a higher-resolution source image." : "Preserve source resolution for generation.",
      profile.background.removable
        ? "Background removal suitability noted; hand off to Product Asset Preparation."
        : "Verify background boundaries before Product Asset Preparation cutout.",
      profile.boundaries.detected
        ? "Product boundary signal recorded for later masking workflows."
        : "Capture a cleaner subject/background separation photo.",
      profile.cameraAngle.includes("requires")
        ? "Capture named front, side, and detail views for stronger camera planning."
        : "Use this identified view in camera planning.",
      ...profile.defects.map((defect) => `Address: ${defect}`),
    ]);
  }
}

export class ImageDefectDetectionEngine {
  detect(
    image: ProductImage,
    quality: ImageIntelligenceProfile["quality"],
    resolution: ImageIntelligenceProfile["resolution"],
  ): string[] {
    return unique([
      ...(image.sizeBytes < 10_000 ? ["limited source resolution"] : []),
      ...(quality.score < 70 ? ["metadata quality below preferred threshold"] : []),
      ...(resolution.tier === "low" ? ["low estimated resolution tier"] : []),
    ]);
  }
}

export class DuplicateImageDetector {
  mark(project: CreativeProject, profiles: ImageIntelligenceProfile[]): ImageIntelligenceProfile[] {
    const byFingerprint = new Map<string, string>();
    return profiles.map((profile) => {
      const image = project.productImages.find((item) => item.id === profile.imageId);
      if (!image) return profile;
      const fingerprint = image.checksumSha256
        ? `sum:${image.checksumSha256}`
        : `${image.mimeType}:${image.sizeBytes}:${normalizeStem(image.fileName)}`;
      const first = byFingerprint.get(fingerprint);
      if (first && first !== profile.imageId) {
        return { ...profile, duplicateOfImageId: first, defects: unique([...profile.defects, "duplicate image of earlier upload"]) };
      }
      byFingerprint.set(fingerprint, profile.imageId);
      return { ...profile, duplicateOfImageId: undefined };
    });
  }
}

export class ImageMetadataManager {
  create(image: ProductImage): Record<string, string | number> {
    return {
      source: "creative-workspace",
      sizeBytes: image.sizeBytes,
      mimeType: image.mimeType,
      uploadedAt: image.uploadedAt,
      generatedAt: new Date().toISOString(),
    };
  }
}

export class ImageHistoryManager {
  constructor(private readonly manager: ImageIntelligenceManager) {}
  record(projectId: string, imageId: string, event: string, detail: string): void {
    this.manager["store"].history.unshift({ id: randomUUID(), at: new Date().toISOString(), projectId, imageId, event, detail });
    this.manager["store"].history.splice(100);
  }
}

export class ImageCacheManager {
  key(project: CreativeProject, image: ProductImage): string {
    return createHash("sha256")
      .update(JSON.stringify({
        version: ANALYSIS_VERSION,
        project: project.id,
        product: project.productInformation,
        image: [image.id, image.fileName, image.mimeType, image.sizeBytes, image.checksumSha256 ?? ""],
      }))
      .digest("hex");
  }
}

export class ImageValidationManager {
  validate(project: CreativeProject): { valid: boolean; issues: string[] } {
    const originals = project.productImages.filter(isOriginalProductImage);
    const issues = [!originals.length ? "Upload at least one product image for analysis." : ""].filter(Boolean);
    return { valid: !issues.length, issues };
  }
}

export class ImageAnalyticsManager {
  constructor(private readonly manager: ImageIntelligenceManager) {}
  summary(): Record<string, number> {
    const profiles = this.manager["store"].profiles;
    return {
      analyzedImages: profiles.length,
      averageQuality: profiles.length ? Math.round(profiles.reduce((sum, profile) => sum + profile.quality.score, 0) / profiles.length) : 0,
      removableBackgrounds: profiles.filter((profile) => profile.background.removable).length,
      boundariesDetected: profiles.filter((profile) => profile.boundaries?.detected).length,
      duplicatesDetected: profiles.filter((profile) => Boolean(profile.duplicateOfImageId)).length,
      defectFlags: profiles.reduce((sum, profile) => sum + profile.defects.length, 0),
      cachedAnalyses: Object.keys(this.manager["store"].cache).length,
    };
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeStem(fileName: string): string {
  return fileName.toLowerCase().replace(/\.(png|jpe?g|webp)$/i, "").replace(/[-_](copy|dup|duplicate|\d+)$/i, "");
}

function normalizeLegacyImageProfile(profile: ImageIntelligenceProfile): ImageIntelligenceProfile {
  return {
    ...profile,
    boundaries: profile.boundaries ?? {
      detected: Boolean(profile.background?.removable),
      confidence: profile.background?.confidence ?? 30,
      notes: "Legacy profile upgraded with boundary placeholder.",
    },
    resolution: profile.resolution ?? {
      tier: Number(profile.metadata?.sizeBytes ?? 0) < 10_000 ? "low" : "standard",
      estimatedFromBytes: Number(((Number(profile.metadata?.sizeBytes ?? 0) || 1) / 180_000).toFixed(2)),
      notes: "Legacy profile upgraded with resolution estimate.",
    },
    viewRole: profile.viewRole ?? detectViewRole(profile.fileName),
  };
}

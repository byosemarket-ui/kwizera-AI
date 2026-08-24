import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, CreativeWorkspaceManager, ProductImage } from "../creative-workspace/creative-workspace-manager.js";
import { detectViewRole, detectViewRoleDetailed } from "../product-intelligence/view-role.js";
import type { ImageIntelligenceProfile, ImageIntelligenceStore } from "./types.js";

const EMPTY: ImageIntelligenceStore = { profiles: [], history: [], cache: {}, logs: [] };

/** Persists local image evidence profiles; never modifies original product image bytes. */
export class ImageIntelligenceManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private workspace: CreativeWorkspaceManager | null = null;
  private store: ImageIntelligenceStore = structuredClone(EMPTY);

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

  async analyzeProject(projectId: string): Promise<ImageIntelligenceProfile[]> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");
    const validation = this.validation.validate(project);
    if (!validation.valid) throw new Error(validation.issues.join(" "));
    const profiles = await Promise.all(project.productImages.map((image) => this.analyzeImage(project, image)));
    const marked = this.duplicates.mark(project, profiles);
    for (const profile of marked) {
      const index = this.store.profiles.findIndex((item) => item.imageId === profile.imageId);
      if (index >= 0) this.store.profiles[index] = profile;
    }
    await this.persist();
    return marked.map((profile) => ({ ...profile }));
  }

  async analyzeImage(project: CreativeProject, image: ProductImage): Promise<ImageIntelligenceProfile> {
    const key = this.cache.key(project, image);
    const cachedId = this.store.cache[key];
    const cached = cachedId ? this.store.profiles.find((profile) => profile.id === cachedId) : undefined;
    if (cached) return { ...cached, cached: true };
    const profile = this.buildProfile(project, image);
    this.store.profiles = this.store.profiles.filter((item) => item.imageId !== image.id);
    this.store.profiles.unshift(profile);
    this.store.cache[key] = profile.id;
    this.history.record(project.id, image.id, "analysis", `Analyzed ${image.fileName}: ${profile.quality.score}/100 quality.`);
    this.log("info", `Image intelligence profile created for ${image.fileName}.`);
    await this.persist();
    return { ...profile };
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

  private buildProfile(project: CreativeProject, image: ProductImage): ImageIntelligenceProfile {
    const evidence = `${project.productInformation.name} ${project.productInformation.description} ${image.fileName}`;
    const quality = this.quality.analyze(image);
    const background = this.background.analyze(evidence);
    const objects = this.objects.detect(project, image);
    const detection = detectViewRoleDetailed(image.fileName);
    const viewRole = detection.role;
    const boundaries = this.boundary.detect(background, evidence);
    const resolution = this.resolution.analyze(image);
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
      lighting: this.lighting.analyze(evidence),
      shadows: this.shadow.analyze(evidence),
      reflections: this.reflection.analyze(evidence),
      cameraAngle: this.camera.analyze(evidence, viewRole),
      composition: this.composition.analyze(evidence),
      perspective: this.perspective.analyze(evidence, viewRole),
      objects,
      scene: this.scene.understand(project, objects, background),
      defects: this.defects.detect(image, quality, resolution),
      enhancements: [],
      metadata: {
        ...this.metadata.create(image),
        originalImageUnmodified: 1,
        backgroundRemovalDeferred: 1,
        viewConfidence: Math.round(detection.confidence * 100),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cached: false,
    };
    profile.enhancements = this.enhancement.recommend(profile);
    return this.analysis.finalize(profile);
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
    return { ...profile, metadata: { ...profile.metadata, provider: "local-image-evidence-analyzer" } };
  }
}

export class ImageQualityAnalyzer {
  analyze(image: ProductImage): ImageIntelligenceProfile["quality"] {
    const sizeScore = image.sizeBytes > 100_000 ? 20 : image.sizeBytes > 10_000 ? 14 : 7;
    const score = Math.min(94, 58 + sizeScore + (image.mimeType === "image/png" ? 8 : 5));
    return {
      score,
      confidence: Math.min(88, score - 8),
      notes: [
        image.sizeBytes < 10_000 ? "Small source file may limit detail retention." : "Source file size supports standard creative use.",
        "Quality is assessed from file metadata until a pixel-level provider is configured.",
        "Original image bytes were not modified.",
      ],
    };
  }
}

export class BackgroundAnalysisEngine {
  analyze(evidence: string): ImageIntelligenceProfile["background"] {
    if (/studio|white|plain|isolated/i.test(evidence)) return { type: "controlled studio background", removable: true, confidence: 72 };
    if (/outdoor|street|nature|lifestyle/i.test(evidence)) return { type: "environmental background", removable: true, confidence: 68 };
    return { type: "background requires visual-provider verification", removable: false, confidence: 38 };
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
  detect(background: ImageIntelligenceProfile["background"], evidence: string): ImageIntelligenceProfile["boundaries"] {
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
  analyze(image: ProductImage): ImageIntelligenceProfile["resolution"] {
    const estimatedFromBytes = Math.max(0.05, Number((image.sizeBytes / 180_000).toFixed(2)));
    const tier = image.sizeBytes < 10_000 ? "low" : image.sizeBytes < 250_000 ? "standard" : "high";
    return {
      tier,
      estimatedFromBytes,
      notes: `Resolution tier ${tier} estimated from ${image.sizeBytes} source bytes (not pixel-decoded).`,
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
    return [
      { label: project.productInformation.name || "primary product", confidence: 86 },
      ...(image.fileName.toLowerCase().includes("bottle") ? [{ label: "bottle", confidence: 82 }] : []),
    ];
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
        project: project.id,
        product: project.productInformation,
        image: [image.id, image.fileName, image.mimeType, image.sizeBytes],
      }))
      .digest("hex");
  }
}

export class ImageValidationManager {
  validate(project: CreativeProject): { valid: boolean; issues: string[] } {
    const issues = [!project.productImages.length ? "Upload at least one product image for analysis." : ""].filter(Boolean);
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

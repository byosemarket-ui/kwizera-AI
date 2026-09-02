import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, ValidationResult } from "../creative-workspace/creative-workspace-manager.js";
import type { MarketingIntelligenceManager } from "../marketing-intelligence/marketing-intelligence-manager.js";
import type { DecisionIntelligenceManager } from "../decision-intelligence/decision-intelligence-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import { ProjectState } from "../state-manager/types.js";
import { appendProvenanceOnce, collapseRepeatedProvenanceMarkers } from "../product-intelligence/provenance-text.js";
import type { CanonicalProductManager } from "../product-record/canonical-product-manager.js";
import type { MarketingBriefManager } from "../marketing-brief/marketing-brief-manager.js";
import { buildConfirmedCommercial, type ConfirmedCommercial } from "./commercial.js";
import { buildProductionScript, type ProductionScript } from "./script-builder.js";
import { purposeToBeat, parseDurationMs, type StoryBeatId } from "./story-structure.js";
import { buildProductionManifest, type ProductionManifest } from "./production-manifest.js";
import { generateCreativeScenes } from "./ai-creative-planner.js";
import type { CreativeToneId, ProductionModeId } from "../video-production/production-mode-types.js";

export type PlanStatus = "DRAFT" | "GENERATING" | "READY_FOR_REVIEW" | "APPROVED_FOR_VIDEO";

export interface PlanScene {
  id: string;
  order: number;
  durationSeconds: number;
  durationMs?: number;
  startMs?: number;
  beat?: StoryBeatId;
  purpose: string;
  visual: string;
  narration: string;
  camera: string;
  lighting: string;
  composition: string;
  animation: string;
  assetId?: string;
  imageRole?: string;
  visualPurpose?: string;
  cameraDirection?: string;
  motion?: string;
  view?: string;
  transition?: string;
  text?: string;
  copy?: {
    headline?: string;
    featureText?: string;
    benefitText?: string;
    supportingText?: string;
    priceOffer?: string;
    callToAction?: string;
  };
  selectedFor?: string;
  selectionReason?: string;
  priority?: number;
  assetRole?: string;
  fieldSources?: Record<string, "AI_RECOMMENDED" | "USER_DEFINED">;
  userEdited?: boolean;
}

export interface CreativePlan {
  id: string;
  projectId: string;
  productId?: string;
  createdAt: string;
  modifiedAt: string;
  version: number;
  analyses: {
    product: string;
    brand: string;
    campaign: string;
    audience: string;
    platform: string;
    language: string;
  };
  creativeBrief: string;
  marketingStrategy: string;
  creativeStrategy: string;
  storyboard: string;
  script: string;
  scenes: PlanScene[];
  cameraPlan: string;
  lightingPlan: string;
  colourStyle: string;
  compositionGuide: string;
  animationPlan: string;
  prompts: { image: string; video: string; audio: string };
  workflow: string[];
  objective?: string;
  audience?: string;
  message?: string;
  angle?: string;
  visualDirection?: string;
  audioDirection?: string;
  callToAction?: string;
  productStateHash?: string;
  userEdited?: boolean;
  marketingBriefId?: string;
  briefVersion?: number;
  manifestId?: string;
  storyBeats?: string[];
  timelineDurationMs?: number;
  aspectRatio?: "9:16" | "1:1" | "16:9";
  platforms?: string[];
  missing?: string[];
  productionStatus?: "DRAFT" | "PARTIALLY_READY" | "READY_FOR_VIDEO_PRODUCTION";
  commercial?: ConfirmedCommercial;
  productionScript?: ProductionScript;
  productionMode?: ProductionModeId;
  creativeTone?: CreativeToneId;
  planStatus?: PlanStatus;
}

export interface PlanResult {
  plan?: CreativePlan;
  validation: ValidationResult;
}

/**
 * Step 2 planning only: it creates editable production direction, never media,
 * rendering, encoding, export, or calls to generation foundations.
 */
export class CreativePlanningManager {
  private root = "";
  private projectsRoot = "";
  private core: AiCoreManager | null = null;
  private marketingIntelligence: MarketingIntelligenceManager | null = null;
  private decisionIntelligence: DecisionIntelligenceManager | null = null;
  private products: ProductIntelligenceManager | null = null;
  private images: ImageIntelligenceManager | null = null;
  private canonical: CanonicalProductManager | null = null;
  private briefs: MarketingBriefManager | null = null;

  async initialize(storageRoot: string, core?: AiCoreManager): Promise<void> {
    this.root = path.join(storageRoot, "creative-planning", "plans");
    this.projectsRoot = path.join(storageRoot, "creative-workspace", "projects");
    this.core = core ?? null;
    await fs.mkdir(this.root, { recursive: true });
  }

  async getPlan(projectId: string): Promise<CreativePlan | null> {
    this.ensureInitialized();
    return this.readJson<CreativePlan | null>(this.planPath(projectId), null);
  }
  attachMarketingIntelligence(manager: MarketingIntelligenceManager): void { this.marketingIntelligence = manager; }
  attachDecisionIntelligence(manager: DecisionIntelligenceManager): void { this.decisionIntelligence = manager; }
  attachProductIntelligence(manager: ProductIntelligenceManager): void { this.products = manager; }
  attachImageIntelligence(manager: ImageIntelligenceManager): void { this.images = manager; }
  attachCanonicalProduct(manager: CanonicalProductManager): void { this.canonical = manager; }
  attachMarketingBrief(manager: MarketingBriefManager): void { this.briefs = manager; }

  validateForPlan(project: CreativeProject): ValidationResult {
    const errors = [
      !project.productInformation.name.trim() ? "Product name is required before creative planning." : "",
      !project.productImages.filter(isOriginalProductImage).length ? "At least one original product image is required." : "",
    ].filter(Boolean);
    return { valid: errors.length === 0, errors };
  }

  async createPlan(
    project: CreativeProject,
    validation: ValidationResult,
    opts?: { productionMode?: ProductionModeId; creativeTone?: CreativeToneId; regenerate?: boolean; durationSeconds?: number },
  ): Promise<PlanResult> {
    this.ensureInitialized();
    if (!validation.valid) return { validation };

    const existing = await this.getPlan(project.id);
    const now = new Date().toISOString();
    try {
      await this.decisionIntelligence?.decide(project.id, "pipeline");
    } catch {
      // Planning can proceed from product + images without a full campaign decision.
    }
    const product = this.products
      ? (await this.products.getProfile(project.id)) ?? await this.products.analyze(project.id).catch(() => null)
      : null;
    const images = this.images ? await this.images.getProfiles(project.id) : [];
    let marketing: { valueProposition: string; strategy: string; ctas: string[]; platform: { recommendations: string[] } } | undefined;
    try {
      marketing = await this.marketingIntelligence?.analyze(project.id);
    } catch {
      marketing = await this.marketingIntelligence?.getProfile(project.id) ?? undefined;
    }
    const canonical = this.canonical
      ? await this.canonical.get(project.id) ?? await this.canonical.sync(project.id).catch(() => null)
      : null;
    const brief = this.briefs ? await this.briefs.get(project.id) : null;
    const preserveExisting = existing && !opts?.regenerate ? existing.scenes : [];
    const plan = await this.buildPlan(project, existing, now, marketing, product, images, canonical, brief, {
      productionMode: opts?.productionMode ?? existing?.productionMode,
      creativeTone: opts?.creativeTone ?? existing?.creativeTone,
      existingScenes: preserveExisting,
      durationSeconds: opts?.durationSeconds,
    });
    this.transition(project.id, ProjectState.Modified);
    this.transition(project.id, ProjectState.Saving);
    await this.writeJson(this.planPath(project.id), plan);
    await this.persistManifest(project, plan, canonical, brief);
    this.transition(project.id, ProjectState.Saved);
    return { plan, validation };
  }

  async updatePlan(projectId: string, changes: Partial<Omit<CreativePlan, "id" | "projectId" | "createdAt" | "modifiedAt" | "version">>): Promise<CreativePlan> {
    const current = await this.getPlan(projectId);
    if (!current) throw new Error("Generate a creative plan before editing it");
    const scenes = Array.isArray(changes.scenes)
      ? this.normalizeEditedScenes(current.scenes, changes.scenes)
      : this.retime(current.scenes);
    const commercial = changes.commercial
      ? buildConfirmedCommercial({
        productName: changes.commercial.productName || current.commercial?.productName,
        currentPrice: changes.commercial.pricing?.currentPrice,
        originalPrice: changes.commercial.pricing?.originalPrice,
        currency: changes.commercial.pricing?.currency,
        promotionMessage: changes.commercial.promotion?.message,
        promotionEnabled: changes.commercial.promotion?.enabled,
        website: changes.commercial.destination?.website,
        phone: changes.commercial.destination?.phone,
        email: changes.commercial.destination?.email,
        socialHandle: changes.commercial.destination?.socialHandle,
      })
      : current.commercial;
    if (changes.commercial && this.briefs) {
      await this.briefs.updateSettings(projectId, {
        userDefined: {
          currentPrice: commercial?.pricing.currentPrice,
          originalPrice: commercial?.pricing.originalPrice,
          currency: commercial?.pricing.currency,
          website: commercial?.destination.website,
          promotionMessage: commercial?.promotion.message,
          phone: commercial?.destination.phone,
          email: commercial?.destination.email,
          socialHandle: commercial?.destination.socialHandle,
        },
      }).catch(() => null);
    }
    const plan: CreativePlan = {
      ...current,
      ...changes,
      analyses: { ...current.analyses, ...changes.analyses },
      prompts: { ...current.prompts, ...changes.prompts },
      scenes,
      commercial,
      timelineDurationMs: scenes.reduce((sum, scene) => sum + (scene.durationMs ?? Math.round((scene.durationSeconds || 0) * 1000)), 0),
      storyBeats: scenes.map((scene) => scene.purpose),
      script: scenes.map((item) => `${item.order}. ${item.narration}`).join("\n"),
      storyboard: scenes.map((item) => `Scene ${item.order}: ${item.purpose} - ${item.visual} (asset ${item.assetId ?? "unassigned"})`).join("\n"),
      missing: commercial?.missing ?? current.missing,
      userEdited: true,
      modifiedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    this.transition(projectId, ProjectState.Modified);
    this.transition(projectId, ProjectState.Saving);
    await this.writeJson(this.planPath(projectId), plan);
    await this.rewriteManifestFromPlan(plan);
    this.transition(projectId, ProjectState.Saved);
    return plan;
  }

  async getManifest(projectId: string): Promise<ProductionManifest | null> {
    this.ensureInitialized();
    return this.readJson<ProductionManifest | null>(this.manifestPath(projectId), null);
  }

  async finalize(projectId: string): Promise<{ plan: CreativePlan; manifest: ProductionManifest }> {
    const plan = await this.getPlan(projectId);
    if (!plan) throw new Error("Generate a creative plan before finalizing");
    if (!plan.scenes.length || plan.scenes.some((scene) => !scene.assetId)) {
      throw new Error("Every scene must reference a real product asset before video production.");
    }
    const next: CreativePlan = {
      ...plan,
      productionStatus: "READY_FOR_VIDEO_PRODUCTION",
      planStatus: "APPROVED_FOR_VIDEO",
      modifiedAt: new Date().toISOString(),
    };
    await this.writeJson(this.planPath(projectId), next);
    const manifest = await this.rewriteManifestFromPlan(next, "READY_FOR_VIDEO_PRODUCTION");
    return { plan: next, manifest };
  }

  getIntegrationStatus(): Record<string, boolean> {
    return {
      aiCore: this.core !== null,
      memoryFoundation: Boolean(this.core?.memoryFoundation),
      knowledgeFoundation: Boolean(this.core?.knowledgeFoundation),
      productIntelligence: Boolean(this.core?.productIntelligenceFoundation),
      imageIntelligence: Boolean(this.core?.imageIntelligenceFoundation),
      marketingIntelligenceRuntime: Boolean(this.marketingIntelligence?.isInitialized()),
      productIntelligenceRuntime: Boolean(this.products?.isInitialized()),
      imageIntelligenceRuntime: Boolean(this.images?.isInitialized()),
      decisionIntelligenceRuntime: Boolean(this.decisionIntelligence?.isInitialized()),
      canonicalProduct: Boolean(this.canonical?.isInitialized()),
      marketingBrief: Boolean(this.briefs?.isInitialized()),
      videoIntelligence: Boolean(this.core?.videoIntelligenceFoundation),
      stateManager: Boolean(this.core?.stateManager),
    };
  }

  private async buildPlan(
    project: CreativeProject,
    existing: CreativePlan | null,
    now: string,
    marketing?: { valueProposition: string; strategy: string; ctas: string[]; platform: { recommendations: string[] } },
    product?: Awaited<ReturnType<ProductIntelligenceManager["analyze"]>> | null,
    images: Awaited<ReturnType<ImageIntelligenceManager["getProfiles"]>> = [],
    canonical?: Awaited<ReturnType<CanonicalProductManager["get"]>>,
    brief?: Awaited<ReturnType<MarketingBriefManager["get"]>>,
    opts?: {
      productionMode?: ProductionModeId;
      creativeTone?: CreativeToneId;
      existingScenes?: PlanScene[];
      durationSeconds?: number;
    },
  ): Promise<CreativePlan> {
    const productInfo = project.productInformation;
    const brand = project.brandInformation;
    const campaign = project.campaignInformation;
    const platforms = brief?.campaign.platforms.length ? brief.campaign.platforms : (project.platform ? [project.platform] : ["instagram"]);
    const platform = platformGuidance(platforms[0] || project.platform);
    const productionMode = opts?.productionMode ?? existing?.productionMode ?? "AI_PRODUCT_MOTION";
    const creativeTone = opts?.creativeTone ?? existing?.creativeTone;
    const resolvedDurationSeconds = opts?.durationSeconds
      ?? (brief?.output.duration ? Math.round(parseDurationMs(brief.output.duration) / 1000) : null)
      ?? (existing?.timelineDurationMs ? Math.round(existing.timelineDurationMs / 1000) : null)
      ?? 30;
    const angle = brief?.marketing.angle || product?.creativeAngles?.[0]?.name;
    const audienceRaw = brief?.campaign.audience.general || product?.customerIntelligence?.customerType || project.targetAudience || "audience requires confirmation";
    const audience = product?.customerIntelligence?.label === "inferred"
      ? appendProvenanceOnce(audienceRaw, "inferred")
      : collapseRepeatedProvenanceMarkers(audienceRaw);
    const commercial = buildConfirmedCommercial({
      productName: canonical?.identity.name || productInfo.name,
      currentPrice: productInfo.price ?? (brief?.userDefined.currentPrice as number | undefined),
      originalPrice: productInfo.originalPrice ?? (brief?.userDefined.originalPrice as number | undefined),
      currency: productInfo.currency ?? brief?.userDefined.currency,
      promotionMessage: campaign.promotionDetails || brief?.userDefined.promotionMessage,
      promotionEnabled: Boolean(campaign.promotionType && campaign.promotionType !== "None"),
      website: brief?.userDefined.website ?? project.brandInformation.website,
      phone: brief?.userDefined.phone,
      email: brief?.userDefined.email,
      socialHandle: brief?.userDefined.socialHandle,
    });
    const message = brief?.marketing.message || product?.valueProposition?.customerBenefit || productInfo.description || productInfo.name;
    const visualDirection = product?.imageObservations?.find((item) => item.field === "lighting")?.value
      || "Keep lighting and colour consistent with the source product photographs.";
    const sceneResult = await generateCreativeScenes({
      project,
      productIntelligence: product,
      assets: images,
      marketingSettings: brief,
      videoSettings: {
        productionMode,
        creativeTone,
        platform: platforms[0] || project.platform || "instagram",
        durationSeconds: resolvedDurationSeconds,
        language: languageName(brief?.campaign.language || project.language),
        objective: brief?.campaign.objective || campaign.objective || "Introduce the product clearly",
      },
      canonical,
      commercial,
      existingScenes: opts?.existingScenes ?? existing?.scenes ?? [],
    });
    const scenes = sceneResult.scenes;
    const cta = brief?.marketing.cta || campaign.callToAction || marketing?.ctas[0] || `Discover ${productInfo.name}`;
    const durationMs = scenes.reduce((sum, scene) => sum + (scene.durationMs ?? Math.round((scene.durationSeconds || 0) * 1000)), 0);
    const productionScript = buildProductionScript(project, scenes.map((scene) => purposeToBeat(scene.beat || scene.purpose)), {
      product: canonical,
      brief,
      commercial,
    });
    return {
      id: existing?.id ?? randomUUID(),
      projectId: project.id,
      productId: canonical?.productId || product?.productId || project.id,
      createdAt: existing?.createdAt ?? now,
      modifiedAt: now,
      version: (existing?.version ?? 0) + 1,
      analyses: {
        product: product?.valueProposition?.productSummary || `${productInfo.name} is a ${productInfo.category || product?.category || canonical?.identity.category || "product"}: ${productInfo.description}`,
        brand: `${brand.name || "brand requires confirmation"}${brand.voice ? ` communicates with a ${brand.voice} voice` : ""}.`,
        campaign: `${brief?.campaign.objective || campaign.name || "campaign"} is focused on ${brief?.campaign.objective || campaign.objective || "introducing the product"}.`,
        audience: `Primary audience: ${audience}.`,
        platform: platform.analysis,
        language: `Use ${languageName(brief?.campaign.language || project.language)} for all on-screen and spoken planning copy.`,
      },
      creativeBrief: `Create a ${platform.tone} ${platform.format} for ${brand.name || productInfo.name} that introduces ${productInfo.name}${brief?.marketing.positioning ? `. ${brief.marketing.positioning}` : ""}${marketing ? ` Marketing value: ${marketing.valueProposition}` : ""}`,
      marketingStrategy: brief?.marketing.message || marketing?.strategy || `Lead with the product, demonstrate a recorded benefit, then close with ${cta}.`,
      creativeStrategy: `${platform.pacing} Angle: ${angle || "product hero"}. Keep ${productInfo.name} the visual priority. Tone stays consistent with ${brief?.campaign.tone || brand.voice || "clear and confident"} direction.`,
      storyboard: scenes.map((item) => `Scene ${item.order}: ${item.purpose} - ${item.visual} (asset ${item.assetId ?? "unassigned"})`).join("\n"),
      script: scenes.map((item) => `${item.order}. ${item.narration}`).join("\n"),
      scenes,
      cameraPlan: scenes.map((item) => `Scene ${item.order}: ${item.cameraDirection || item.camera}`).join("\n"),
      lightingPlan: scenes.map((item) => `Scene ${item.order}: ${item.lighting}`).join("\n"),
      colourStyle: brand.guidelines || product?.imageObservations?.find((item) => item.field === "visible-color")?.value || "Use a balanced neutral base with one accent aligned to the product colour.",
      compositionGuide: scenes.map((item) => `Scene ${item.order}: ${item.composition}`).join("\n"),
      animationPlan: scenes.map((item) => `Scene ${item.order}: ${item.animation}`).join("\n"),
      prompts: {
        image: `${productInfo.name}, ${productInfo.category}, ${productInfo.description}, ${brand.name || ""} brand direction, ${platform.format}, product hero composition, ${audience}, ${languageName(project.language)} campaign context${marketing ? `, ${marketing.valueProposition}` : ""}`,
        video: `${platform.format}; ${scenes.map((item) => item.visual).join(" Then ")}; ${platform.pacing.toLowerCase()}; end with ${cta}. This is a production plan, not a generated video.`,
        audio: `${languageName(project.language)} voice direction: ${brand.voice || "clear and confident"}. Pace: ${platform.pacing.toLowerCase()}. Script: ${scenes.map((item) => item.narration).join(" ")}`,
      },
      workflow: ["Confirm approved creative brief", "Prepare product image references", "Review storyboard and script", "Review camera, lighting, composition, colour, and animation plans", "Approve prompts for the later production pipeline"],
      objective: brief?.campaign.objective || campaign.objective || "Introduce the product clearly",
      audience,
      message,
      angle: angle || "product hero",
      visualDirection,
      audioDirection: `${languageName(brief?.campaign.language || project.language)}, ${brief?.campaign.tone || brand.voice || "clear and confident"}`,
      callToAction: cta,
      productStateHash: createHash("sha256").update(JSON.stringify({
        product: project.productInformation,
        images: project.productImages.map((image) => [image.id, image.checksumSha256 ?? image.sizeBytes]),
        briefId: brief?.briefId ?? "",
        planVersion: existing?.version ?? 0,
      })).digest("hex"),
      userEdited: existing?.userEdited ?? false,
      marketingBriefId: brief?.briefId,
      briefVersion: brief?.briefVersion,
      storyBeats: scenes.map((scene) => scene.purpose),
      timelineDurationMs: durationMs,
      aspectRatio: (brief?.output.aspectRatio || undefined) as CreativePlan["aspectRatio"],
      platforms,
      missing: commercial.missing,
      productionStatus: scenes.every((scene) => scene.assetId) ? (commercial.missing.length ? "PARTIALLY_READY" : "DRAFT") : "DRAFT",
      commercial,
      productionScript,
      productionMode,
      creativeTone,
      planStatus: scenes.length && scenes.every((s) => s.assetId) ? "READY_FOR_REVIEW" : "DRAFT",
    };
  }

  private normalizeEditedScenes(previous: PlanScene[], next: PlanScene[]): PlanScene[] {
    return this.retime(next.map((scene, index) => {
      const prior = previous.find((item) => item.id === scene.id);
      const durationMs = (() => {
        if (prior && scene.durationSeconds != null && scene.durationSeconds !== prior.durationSeconds) {
          return Math.round(scene.durationSeconds * 1000);
        }
        return scene.durationMs ?? Math.round((scene.durationSeconds || prior?.durationSeconds || 2) * 1000);
      })();
      const fieldSources = { ...(prior?.fieldSources ?? {}), ...(scene.fieldSources ?? {}) };
      for (const key of ["assetId", "text", "camera", "motion", "durationMs", "narration"] as const) {
        if (scene[key] != null && prior && scene[key] !== prior[key]) fieldSources[key] = "USER_DEFINED";
      }
      return {
        ...prior,
        ...scene,
        order: scene.order ?? index + 1,
        durationMs,
        durationSeconds: durationMs / 1000,
        fieldSources,
        userEdited: true,
      };
    }));
  }

  private retime(scenes: PlanScene[]): PlanScene[] {
    let cursor = 0;
    return scenes.map((scene, index) => {
      const durationMs = Math.max(800, scene.durationMs ?? Math.round((scene.durationSeconds || 2) * 1000));
      const next = { ...scene, order: index + 1, startMs: cursor, durationMs, durationSeconds: durationMs / 1000 };
      cursor += durationMs;
      return next;
    });
  }

  private async persistManifest(
    project: CreativeProject,
    plan: CreativePlan,
    canonical: Awaited<ReturnType<CanonicalProductManager["get"]>>,
    brief: Awaited<ReturnType<MarketingBriefManager["get"]>>,
    status?: ProductionManifest["status"],
  ): Promise<ProductionManifest> {
    const commercial = buildConfirmedCommercial({
      productName: canonical?.identity.name || project.productInformation.name,
      currentPrice: project.productInformation.price ?? (brief?.userDefined.currentPrice as number | undefined),
      originalPrice: project.productInformation.originalPrice ?? (brief?.userDefined.originalPrice as number | undefined),
      currency: project.productInformation.currency ?? brief?.userDefined.currency,
      promotionMessage: project.campaignInformation.promotionDetails || brief?.userDefined.promotionMessage,
      website: brief?.userDefined.website ?? project.brandInformation.website,
    });
    const beats = plan.scenes.map((scene) => purposeToBeat(scene.beat || scene.purpose));
    const script = plan.productionScript ?? buildProductionScript(project, beats, {
      product: canonical,
      brief,
      commercial,
    });
    const previous = await this.getManifest(plan.projectId);
    const manifest = buildProductionManifest({
      plan,
      commercial,
      script,
      missing: commercial.missing,
      platforms: plan.platforms ?? brief?.campaign.platforms ?? [],
      aspectRatio: plan.aspectRatio || brief?.output.aspectRatio || "",
      marketingBriefId: brief?.briefId || plan.marketingBriefId,
      briefVersion: brief?.briefVersion || plan.briefVersion,
      previous,
    });
    if (status) manifest.status = status;
    plan.manifestId = manifest.manifestId;
    plan.productionStatus = manifest.status;
    plan.commercial = commercial;
    plan.productionScript = script;
    await this.writeJson(this.planPath(plan.projectId), plan);
    await this.writeJson(this.manifestPath(plan.projectId), manifest);
    return manifest;
  }

  private async rewriteManifestFromPlan(plan: CreativePlan, status?: ProductionManifest["status"]): Promise<ProductionManifest> {
    const previous = await this.getManifest(plan.projectId);
    const commercial = plan.commercial ?? previous?.commercial ?? buildConfirmedCommercial({ productName: plan.analyses.product });
    const script = plan.productionScript ?? previous?.script ?? {
      headline: plan.callToAction || "",
      hook: plan.message || "",
      productName: "",
      mainMessage: plan.message || "",
      supportingPoints: [],
      featureText: "",
      cta: plan.callToAction || "",
      narration: plan.scenes.map((scene) => scene.narration),
    };
    const manifest = buildProductionManifest({
      plan,
      commercial,
      script,
      missing: plan.missing ?? commercial.missing,
      platforms: plan.platforms ?? [],
      aspectRatio: plan.aspectRatio,
      marketingBriefId: plan.marketingBriefId,
      briefVersion: plan.briefVersion,
      previous,
    });
    if (status) manifest.status = status;
    plan.manifestId = manifest.manifestId;
    plan.productionStatus = manifest.status;
    await this.writeJson(this.manifestPath(plan.projectId), manifest);
    await this.writeJson(this.planPath(plan.projectId), plan);
    return manifest;
  }

  private manifestPath(projectId: string): string {
    return path.join(this.projectsRoot, projectId, "production-manifest.json");
  }

  private transition(projectId: string, state: ProjectState): void {
    this.core?.stateManager?.updateProjectState(projectId, state, { systemAction: "creative-planning", metadata: { source: "creative-planning" } });
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try { return JSON.parse(await fs.readFile(filePath, "utf8")) as T; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      throw new Error(`Unable to read creative plan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${createHash("sha1").update(randomUUID()).digest("hex")}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temporary, filePath);
  }

  private ensureInitialized(): void { if (!this.root) throw new Error("Creative Planning Manager is not initialized"); }
  private planPath(projectId: string): string { return path.join(this.root, `${projectId}.json`); }
}

function languageName(language: string): string {
  return ({ en: "English", fr: "French", sw: "Swahili", rw: "Kinyarwanda" } as Record<string, string>)[language] ?? language;
}

function platformGuidance(platform: string): { format: string; tone: string; pacing: string; analysis: string } {
  const guidance: Record<string, { format: string; tone: string; pacing: string; analysis: string }> = {
    instagram: { format: "vertical social video", tone: "polished and human", pacing: "Use a fast first three seconds and concise benefit-led beats.", analysis: "Instagram prioritizes immediate visual impact, concise storytelling, and a clear saved/shared value proposition." },
    tiktok: { format: "vertical short-form video", tone: "direct and native", pacing: "Use a native-feeling hook and fast, honest demonstration.", analysis: "TikTok rewards fast hooks, authentic demonstrations, and direct conversational pacing." },
    facebook: { format: "social video", tone: "clear and trust-building", pacing: "Use clear benefits with readable messaging and a strong closing CTA.", analysis: "Facebook supports benefit-led storytelling that earns attention before the action request." },
    linkedin: { format: "professional social video", tone: "credible and considered", pacing: "Use a concise business-relevant hook and evidence-led value.", analysis: "LinkedIn responds to credible insight, professional presentation, and a clear strategic outcome." },
    youtube: { format: "video content", tone: "informative and engaging", pacing: "Open with value, then progress through a clear narrative arc.", analysis: "YouTube benefits from clear narrative structure, sustained value, and a memorable closing." },
  };
  return guidance[platform] ?? guidance.instagram;
}
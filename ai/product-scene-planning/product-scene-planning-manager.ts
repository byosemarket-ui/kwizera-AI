import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import type { ProductAssetPreparationManager } from "../product-asset-preparation/product-asset-preparation-manager.js";
import type { ProductAssetPreparationResult, ProductAssetRecord, ProductAssetViewType } from "../product-asset-preparation/types.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import type {
  AiMeProductScenePlanningAwareness,
  MarketingFlowStage,
  PlannedProductScene,
  ProductSceneExplainResult,
  ProductSceneHealthReport,
  ProductScenePlanResult,
  ProductScenePlanningStore,
  ProductSceneType,
  ProductUtilizationPlan,
  ScenePlanningQuality,
} from "./types.js";

const EMPTY: ProductScenePlanningStore = { plans: [], cache: {}, history: [], logs: [] };

const FLOW_ORDER: MarketingFlowStage[] = [
  "attention",
  "interest",
  "product-reveal",
  "product-features",
  "benefits",
  "trust",
  "price",
  "offer",
  "call-to-action",
];

interface SceneBlueprint {
  sceneType: ProductSceneType;
  sceneName: string;
  flow: MarketingFlowStage;
  priority: PlannedProductScene["priority"];
  durationSeconds: number;
  preferredViews: ProductAssetViewType[];
  cameraAngle: string;
  cameraMovement: string;
  lightingStyle: string;
  backgroundStyle: string;
  environment: string;
  animationStyle: string;
  transitionType: string;
  knowledgeDomains: string[];
  required?: (ctx: PlanningContext) => boolean;
}

interface PlanningContext {
  project: CreativeProject;
  product: ProductIntelligenceProfile;
  assets: ProductAssetRecord[];
  prepared: ProductAssetPreparationResult;
  marketingGoal: string;
}

/** Step 3 runtime: plans professional marketing scenes from product profile + prepared assets. Does not generate storyboards or video. */
export class ProductScenePlanningManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private workspace: CreativeWorkspaceManager | null = null;
  private products: ProductIntelligenceManager | null = null;
  private assets: ProductAssetPreparationManager | null = null;
  private store: ProductScenePlanningStore = structuredClone(EMPTY);

  readonly designer = new SceneDesignEngine();
  readonly flow = new MarketingFlowEngine();
  readonly utilization = new ProductUtilizationEngine();
  readonly knowledge = new SceneKnowledgeBridge();
  readonly quality = new ScenePlanningQualityEngine();
  readonly health = new ProductSceneHealthManager(this);

  async initialize(
    storageRoot: string,
    dependencies: {
      core: AiCoreManager;
      workspace: CreativeWorkspaceManager;
      products: ProductIntelligenceManager;
      assets: ProductAssetPreparationManager;
    },
  ): Promise<void> {
    this.root = path.join(storageRoot, "product-scene-planning-runtime");
    this.core = dependencies.core;
    this.workspace = dependencies.workspace;
    this.products = dependencies.products;
    this.assets = dependencies.assets;
    await fs.mkdir(this.root, { recursive: true });
    this.store = await this.readStore();
    this.log("info", "Product scene planning runtime restored.");
    await this.persist();
  }

  isInitialized(): boolean {
    return Boolean(this.root && this.workspace && this.products && this.assets);
  }

  async planProductScenes(projectId: string): Promise<ProductScenePlanResult> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");
    if (!project.productImages.filter(isOriginalProductImage).length) {
      throw new Error("Upload original product images before scene planning.");
    }

    const product = await this.products!.analyzeProductIntelligence(projectId);
    const prepared = await this.assets!.prepareProductAssets(projectId);
    if (!prepared.assets.length) throw new Error("Prepare product assets (Step 2) before scene planning.");

    const marketingGoal = resolveMarketingGoal(project);
    const cacheKey = this.cacheKey(project, product, prepared, marketingGoal);
    const cachedId = this.store.cache[cacheKey];
    const cached = cachedId ? this.store.plans.find((plan) => plan.planId === cachedId) : undefined;
    if (cached) return { ...cached, cached: true };

    const ctx: PlanningContext = { project, product, assets: prepared.assets, prepared, marketingGoal };
    const knowledgeUsed = this.knowledge.domainsUsed(this.core);
    let scenes = this.designer.design(ctx, knowledgeUsed);
    scenes = this.flow.orderScenes(scenes);
    scenes = this.dedupeScenes(scenes);
    scenes = this.utilization.assign(scenes, ctx);

    let quality = this.quality.evaluate(scenes, ctx);
    const repairs: string[] = [];
    if (quality.issues.length) {
      const repaired = this.repairPlan(scenes, ctx, quality.issues);
      scenes = repaired.scenes;
      repairs.push(...repaired.repairs);
      quality = this.quality.evaluate(scenes, ctx);
      quality.repairs = repairs;
    }

    const missingScenes = this.flow.detectMissingScenes(scenes, ctx);
    const weakFlowNotes = this.flow.detectWeakFlow(scenes);
    const recommendedOrder = this.flow.recommendOrder(scenes);
    const now = new Date().toISOString();
    const result: ProductScenePlanResult = {
      planId: randomUUID(),
      projectId,
      productId: product.id,
      productName: product.productName,
      marketingGoal,
      sceneCount: scenes.length,
      scenes,
      sequence: scenes.map((scene) => `${scene.order}. ${scene.sceneName}`),
      missingScenes,
      weakFlowNotes,
      recommendedOrder,
      productUsageCoverage: this.utilization.coverage(scenes, prepared.assets),
      quality,
      knowledgeUsed,
      creativePipelineStep: 3,
      storyboardGenerationDeferred: true,
      videoGenerationDeferred: true,
      createdAt: now,
      updatedAt: now,
      cached: false,
    };

    this.store.plans = this.store.plans.filter((plan) => plan.projectId !== projectId);
    this.store.plans.unshift(result);
    this.store.cache[cacheKey] = result.planId;
    this.history(projectId, "plan", `Planned ${result.sceneCount} product scene(s) for ${product.productName}.`);
    this.log("info", `Product scene plan ready for ${project.name}.`);
    await this.persist();
    return structuredClone(result);
  }

  async getPlan(projectId: string): Promise<ProductScenePlanResult | null> {
    return this.store.plans.find((plan) => plan.projectId === projectId) ?? null;
  }

  async explainScenes(projectId: string): Promise<ProductSceneExplainResult> {
    const plan = (await this.getPlan(projectId)) ?? (await this.planProductScenes(projectId));
    return {
      planId: plan.planId,
      productName: plan.productName,
      summary: `Planned ${plan.sceneCount} marketing scenes for ${plan.productName} toward "${plan.marketingGoal}". Storyboard and video generation remain deferred.`,
      sceneExplanations: plan.scenes.map((scene) => ({
        sceneId: scene.sceneId,
        sceneName: scene.sceneName,
        why: scene.whyThisScene,
        flowStage: scene.marketingFlowStage,
      })),
      recommendedOrder: plan.recommendedOrder,
      missingScenes: plan.missingScenes,
      weakFlowNotes: plan.weakFlowNotes,
      readyForStoryboard: plan.quality.overall >= 70 && plan.sceneCount >= 4,
    };
  }

  async recommendSceneOrder(projectId: string): Promise<string[]> {
    const plan = (await this.getPlan(projectId)) ?? (await this.planProductScenes(projectId));
    return [...plan.recommendedOrder];
  }

  async detectMissingScenes(projectId: string): Promise<ProductSceneType[]> {
    const plan = (await this.getPlan(projectId)) ?? (await this.planProductScenes(projectId));
    return [...plan.missingScenes];
  }

  async detectWeakMarketingFlow(projectId: string): Promise<string[]> {
    const plan = (await this.getPlan(projectId)) ?? (await this.planProductScenes(projectId));
    return [...plan.weakFlowNotes];
  }

  getAiMeProductScenePlanningAwareness(): AiMeProductScenePlanningAwareness {
    const available = this.isInitialized();
    return {
      available,
      enabled: available,
      offlineFirst: true,
      canExplainScenes: available,
      canRecommendSceneOrder: available,
      canDetectMissingScenes: available,
      canDetectWeakMarketingFlow: available,
      storyboardGenerationDeferred: true,
      videoGenerationDeferred: true,
      summary: available
        ? "AI Me Product Scene Planning is online: explain scenes, recommend order, detect missing scenes and weak marketing flow. Storyboard and video generation remain deferred."
        : "Product Scene Planning runtime is not initialized.",
    };
  }

  async runHealthCheck(projectId?: string): Promise<ProductSceneHealthReport> {
    return this.health.check(projectId);
  }

  async repair(projectId?: string): Promise<ProductSceneHealthReport> {
    return this.health.repair(projectId);
  }

  async getDashboard(projectId?: string): Promise<{
    plans: ProductScenePlanResult[];
    history: ProductScenePlanningStore["history"];
    logs: ProductScenePlanningStore["logs"];
    awareness: AiMeProductScenePlanningAwareness;
    analytics: Record<string, number>;
  }> {
    const plans = this.store.plans.filter((plan) => !projectId || plan.projectId === projectId);
    return {
      plans: structuredClone(plans),
      history: this.store.history.filter((item) => !projectId || item.projectId === projectId),
      logs: [...this.store.logs],
      awareness: this.getAiMeProductScenePlanningAwareness(),
      analytics: {
        plans: plans.length,
        averageScenes: plans.length ? Math.round(plans.reduce((sum, plan) => sum + plan.sceneCount, 0) / plans.length) : 0,
        averageQuality: plans.length ? Math.round(plans.reduce((sum, plan) => sum + plan.quality.overall, 0) / plans.length) : 0,
        cachedPlans: Object.keys(this.store.cache).length,
      },
    };
  }

  async persist(): Promise<void> {
    await fs.writeFile(path.join(this.root, "plans.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8");
  }

  log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.unshift({ at: new Date().toISOString(), level, message });
    this.store.logs.splice(100);
    this.core?.logger.info("product-scene-planning", message);
  }

  history(projectId: string, event: string, detail: string): void {
    this.store.history.unshift({ id: randomUUID(), at: new Date().toISOString(), projectId, event, detail });
    this.store.history.splice(100);
  }

  private cacheKey(
    project: CreativeProject,
    product: ProductIntelligenceProfile,
    prepared: ProductAssetPreparationResult,
    marketingGoal: string,
  ): string {
    return createHash("sha256")
      .update(JSON.stringify({
        projectId: project.id,
        productId: product.id,
        marketingGoal,
        assets: prepared.assets.map((asset) => [asset.assetId, asset.viewType, asset.fingerprint]),
        campaign: project.campaignInformation,
        audience: project.targetAudience,
      }))
      .digest("hex");
  }

  private dedupeScenes(scenes: PlannedProductScene[]): PlannedProductScene[] {
    const seen = new Set<ProductSceneType>();
    return scenes.filter((scene) => {
      if (seen.has(scene.sceneType)) return false;
      seen.add(scene.sceneType);
      return true;
    }).map((scene, index) => ({ ...scene, order: index + 1 }));
  }

  private repairPlan(
    scenes: PlannedProductScene[],
    ctx: PlanningContext,
    issues: string[],
  ): { scenes: PlannedProductScene[]; repairs: string[] } {
    const repairs: string[] = [];
    let next = [...scenes];
    if (issues.some((issue) => issue.includes("missing call-to-action"))) {
      const cta = this.designer.buildScene(BLUEPRINTS.find((item) => item.sceneType === "call-to-action")!, ctx, ["marketing", "customer-psychology"]);
      next.push(cta);
      repairs.push("added-call-to-action-scene");
    }
    if (issues.some((issue) => issue.includes("missing product-reveal"))) {
      const reveal = this.designer.buildScene(BLUEPRINTS.find((item) => item.sceneType === "product-reveal")!, ctx, ["storytelling", "camera"]);
      next = [reveal, ...next.filter((scene) => scene.sceneType !== "product-reveal")];
      repairs.push("added-product-reveal-scene");
    }
    if (issues.some((issue) => issue.includes("weak flow order"))) {
      next = this.flow.orderScenes(next);
      repairs.push("reordered-marketing-flow");
    }
    if (issues.some((issue) => issue.includes("unused product asset"))) {
      next = this.utilization.assign(next, ctx);
      repairs.push("reassigned-product-assets");
    }
    next = this.dedupeScenes(next);
    return { scenes: next, repairs };
  }

  private async readStore(): Promise<ProductScenePlanningStore> {
    try {
      const value = JSON.parse(await fs.readFile(path.join(this.root, "plans.json"), "utf8")) as Partial<ProductScenePlanningStore>;
      return {
        ...structuredClone(EMPTY),
        ...value,
        plans: value.plans ?? [],
        cache: value.cache ?? {},
        history: value.history ?? [],
        logs: value.logs ?? [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY);
      throw error;
    }
  }

  private ensureReady(): void {
    if (!this.isInitialized()) throw new Error("Product Scene Planning Manager is not initialized");
  }
}

const BLUEPRINTS: SceneBlueprint[] = [
  {
    sceneType: "hero-introduction",
    sceneName: "Hero Introduction",
    flow: "attention",
    priority: "critical",
    durationSeconds: 3,
    preferredViews: ["front"],
    cameraAngle: "eye-level hero framing",
    cameraMovement: "slow push-in",
    lightingStyle: "key + fill product lighting",
    backgroundStyle: "clean brand-safe gradient",
    environment: "controlled studio",
    animationStyle: "subtle scale-in",
    transitionType: "fade",
    knowledgeDomains: ["storytelling", "camera", "lighting", "marketing"],
  },
  {
    sceneType: "product-reveal",
    sceneName: "Product Reveal",
    flow: "product-reveal",
    priority: "critical",
    durationSeconds: 3,
    preferredViews: ["front", "side"],
    cameraAngle: "three-quarter product angle",
    cameraMovement: "orbit reveal",
    lightingStyle: "rim-accent reveal lighting",
    backgroundStyle: "soft isolated backdrop",
    environment: "studio pedestal",
    animationStyle: "reveal wipe",
    transitionType: "match-cut",
    knowledgeDomains: ["storytelling", "camera", "composition"],
  },
  {
    sceneType: "showcase-360",
    sceneName: "360 Product Showcase",
    flow: "interest",
    priority: "high",
    durationSeconds: 4,
    preferredViews: ["front", "left", "right", "back", "side"],
    cameraAngle: "orbiting mid shot",
    cameraMovement: "360 orbit",
    lightingStyle: "even wrap lighting",
    backgroundStyle: "neutral infinity",
    environment: "turntable studio",
    animationStyle: "continuous rotation",
    transitionType: "cut",
    knowledgeDomains: ["camera", "video-production", "composition"],
    required: (ctx) => ctx.assets.filter((asset) => ["front", "left", "right", "back", "side"].includes(asset.viewType)).length >= 2,
  },
  {
    sceneType: "feature-highlight",
    sceneName: "Feature Highlight",
    flow: "product-features",
    priority: "high",
    durationSeconds: 3,
    preferredViews: ["detail", "front", "close-up"],
    cameraAngle: "feature-focused close framing",
    cameraMovement: "gentle pan across feature",
    lightingStyle: "directional accent",
    backgroundStyle: "dimmed supporting backdrop",
    environment: "macro studio",
    animationStyle: "callout pulse",
    transitionType: "cut",
    knowledgeDomains: ["marketing", "customer-psychology", "composition"],
    required: (ctx) => (ctx.product.features?.length ?? 0) > 0 || (ctx.product.sellingPoints?.length ?? 0) > 0,
  },
  {
    sceneType: "material-close-up",
    sceneName: "Material Close-up",
    flow: "benefits",
    priority: "medium",
    durationSeconds: 2.5,
    preferredViews: ["close-up", "detail"],
    cameraAngle: "macro top/side",
    cameraMovement: "micro push-in",
    lightingStyle: "soft texture lighting",
    backgroundStyle: "minimal blur",
    environment: "detail table",
    animationStyle: "texture reveal",
    transitionType: "dissolve",
    knowledgeDomains: ["lighting", "composition", "branding"],
    required: (ctx) => ctx.product.materials.some((item) => !item.includes("verification"))
      || ctx.assets.some((asset) => asset.viewType === "close-up" || asset.viewType === "detail"),
  },
  {
    sceneType: "detail-showcase",
    sceneName: "Detail Showcase",
    flow: "product-features",
    priority: "medium",
    durationSeconds: 2.5,
    preferredViews: ["detail", "close-up"],
    cameraAngle: "detail insert",
    cameraMovement: "static with focus pull",
    lightingStyle: "hard/soft hybrid for edges",
    backgroundStyle: "controlled dark accent",
    environment: "detail insert set",
    animationStyle: "highlight underline",
    transitionType: "cut",
    knowledgeDomains: ["composition", "camera"],
    required: (ctx) => ctx.assets.some((asset) => asset.viewType === "detail" || asset.viewType === "close-up"),
  },
  {
    sceneType: "lifestyle-scene",
    sceneName: "Lifestyle Scene",
    flow: "benefits",
    priority: "medium",
    durationSeconds: 3,
    preferredViews: ["front", "side"],
    cameraAngle: "lifestyle eye-level",
    cameraMovement: "handheld-stable glide",
    lightingStyle: "natural motivated light",
    backgroundStyle: "contextual lifestyle environment",
    environment: "audience-relevant setting",
    animationStyle: "live-use insert",
    transitionType: "fade",
    knowledgeDomains: ["storytelling", "social-media", "customer-psychology"],
    required: (ctx) => Boolean(ctx.project.targetAudience.trim()),
  },
  {
    sceneType: "product-rotation",
    sceneName: "Product Rotation",
    flow: "interest",
    priority: "medium",
    durationSeconds: 3,
    preferredViews: ["front", "side", "left", "right"],
    cameraAngle: "centered product lock-off",
    cameraMovement: "yaw rotation",
    lightingStyle: "consistent wrap",
    backgroundStyle: "seamless studio",
    environment: "rotation rig",
    animationStyle: "smooth spin",
    transitionType: "cut",
    knowledgeDomains: ["camera", "video-production"],
    required: (ctx) => ctx.assets.length >= 2,
  },
  {
    sceneType: "brand-scene",
    sceneName: "Brand Scene",
    flow: "trust",
    priority: "high",
    durationSeconds: 2,
    preferredViews: ["front"],
    cameraAngle: "centered brand lockup",
    cameraMovement: "static hold",
    lightingStyle: "brand-clean soft light",
    backgroundStyle: "brand color field",
    environment: "brand slate",
    animationStyle: "logo settle",
    transitionType: "fade",
    knowledgeDomains: ["branding", "marketing"],
    required: (ctx) => Boolean(ctx.product.brand && !ctx.product.brand.includes("requires")),
  },
  {
    sceneType: "price-presentation",
    sceneName: "Price Presentation",
    flow: "price",
    priority: "high",
    durationSeconds: 2,
    preferredViews: ["front"],
    cameraAngle: "product with lower-third framing",
    cameraMovement: "subtle settle",
    lightingStyle: "clear commercial lighting",
    backgroundStyle: "offer-safe clean plate",
    environment: "commerce slate",
    animationStyle: "price card rise",
    transitionType: "cut",
    knowledgeDomains: ["marketing", "customer-psychology"],
    required: (ctx) => typeof ctx.product.price === "number",
  },
  {
    sceneType: "promotional-offer",
    sceneName: "Promotional Offer",
    flow: "offer",
    priority: "medium",
    durationSeconds: 2,
    preferredViews: ["front"],
    cameraAngle: "offer-focused mid shot",
    cameraMovement: "static",
    lightingStyle: "bright promotional lighting",
    backgroundStyle: "offer accent plate",
    environment: "promo slate",
    animationStyle: "badge pop",
    transitionType: "cut",
    knowledgeDomains: ["marketing", "social-media"],
    required: (ctx) => /offer|sale|promo|discount|launch/i.test(`${ctx.marketingGoal} ${ctx.project.campaignInformation.objective} ${ctx.project.campaignInformation.notes ?? ""}`),
  },
  {
    sceneType: "call-to-action",
    sceneName: "Call-To-Action Scene",
    flow: "call-to-action",
    priority: "critical",
    durationSeconds: 2.5,
    preferredViews: ["front"],
    cameraAngle: "direct address product frame",
    cameraMovement: "hold",
    lightingStyle: "high-clarity commercial lighting",
    backgroundStyle: "CTA-safe clean plate",
    environment: "end-card set",
    animationStyle: "CTA button emphasis",
    transitionType: "fade",
    knowledgeDomains: ["marketing", "customer-psychology", "social-media"],
  },
  {
    sceneType: "closing-scene",
    sceneName: "Closing Scene",
    flow: "call-to-action",
    priority: "high",
    durationSeconds: 2,
    preferredViews: ["front"],
    cameraAngle: "brand end-frame",
    cameraMovement: "slow pull-back",
    lightingStyle: "soft closing light",
    backgroundStyle: "brand close plate",
    environment: "closing slate",
    animationStyle: "logo lock",
    transitionType: "fade-to-end",
    knowledgeDomains: ["branding", "storytelling"],
  },
];

export class SceneDesignEngine {
  design(ctx: PlanningContext, knowledgeUsed: string[]): PlannedProductScene[] {
    const selected = BLUEPRINTS.filter((blueprint) => !blueprint.required || blueprint.required(ctx));
    // Always keep critical marketing spine even if optional filters removed extras.
    const must = BLUEPRINTS.filter((blueprint) => ["hero-introduction", "product-reveal", "call-to-action", "closing-scene"].includes(blueprint.sceneType));
    const merged = uniqueBlueprints([...must, ...selected]);
    return merged.map((blueprint) => this.buildScene(blueprint, ctx, knowledgeUsed));
  }

  buildScene(blueprint: SceneBlueprint, ctx: PlanningContext, knowledgeUsed: string[]): PlannedProductScene {
    const view = pickView(blueprint.preferredViews, ctx.assets);
    const feature = ctx.product.sellingPoints[0]?.point || ctx.product.features[0] || ctx.product.productName;
    return {
      sceneId: randomUUID(),
      sceneName: blueprint.sceneName,
      sceneType: blueprint.sceneType,
      order: 0,
      priority: blueprint.priority,
      objective: objectiveFor(blueprint, ctx, feature),
      purpose: purposeFor(blueprint),
      marketingFlowStage: blueprint.flow,
      durationSeconds: blueprint.durationSeconds,
      productView: view,
      cameraAngle: blueprint.cameraAngle,
      cameraMovement: blueprint.cameraMovement,
      lightingStyle: blueprint.lightingStyle,
      backgroundStyle: blueprint.backgroundStyle,
      environment: blueprint.environment,
      animationStyle: blueprint.animationStyle,
      transitionType: blueprint.transitionType,
      productUtilization: [],
      whyThisScene: whyFor(blueprint, ctx, feature),
      knowledgeDomains: uniqueStrings([...blueprint.knowledgeDomains, ...knowledgeUsed.filter((domain) => blueprint.knowledgeDomains.includes(domain))]),
      metadata: {
        productName: ctx.product.productName,
        brand: ctx.product.brand,
        marketingGoal: ctx.marketingGoal,
        platform: ctx.project.platform || "general",
        creativePipelineStep: 3,
        storyboardDeferred: true,
      },
    };
  }
}

export class MarketingFlowEngine {
  orderScenes(scenes: PlannedProductScene[]): PlannedProductScene[] {
    return [...scenes]
      .sort((a, b) => {
        const flowDelta = FLOW_ORDER.indexOf(a.marketingFlowStage) - FLOW_ORDER.indexOf(b.marketingFlowStage);
        if (flowDelta !== 0) return flowDelta;
        const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
        return priorityRank[a.priority] - priorityRank[b.priority];
      })
      .map((scene, index) => ({ ...scene, order: index + 1 }));
  }

  detectMissingScenes(scenes: PlannedProductScene[], ctx: PlanningContext): ProductSceneType[] {
    const present = new Set(scenes.map((scene) => scene.sceneType));
    const missing: ProductSceneType[] = [];
    for (const required of ["hero-introduction", "product-reveal", "call-to-action", "closing-scene"] as ProductSceneType[]) {
      if (!present.has(required)) missing.push(required);
    }
    if (typeof ctx.product.price === "number" && !present.has("price-presentation")) missing.push("price-presentation");
    if ((ctx.product.features.length > 0 || ctx.product.sellingPoints.length > 0) && !present.has("feature-highlight")) {
      missing.push("feature-highlight");
    }
    return missing;
  }

  detectWeakFlow(scenes: PlannedProductScene[]): string[] {
    const notes: string[] = [];
    const stages = scenes.map((scene) => scene.marketingFlowStage);
    if (!stages.includes("attention")) notes.push("Marketing flow lacks an attention opener.");
    if (!stages.includes("product-reveal")) notes.push("Marketing flow lacks a product reveal beat.");
    if (!stages.includes("call-to-action")) notes.push("Marketing flow lacks a call-to-action close.");
    for (let i = 1; i < scenes.length; i += 1) {
      const prev = FLOW_ORDER.indexOf(scenes[i - 1]!.marketingFlowStage);
      const curr = FLOW_ORDER.indexOf(scenes[i]!.marketingFlowStage);
      if (curr + 2 < prev) notes.push(`Scene order regresses between ${scenes[i - 1]!.sceneName} and ${scenes[i]!.sceneName}.`);
    }
    const total = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
    if (total < 8) notes.push("Total planned duration is short for a complete marketing arc.");
    return notes;
  }

  recommendOrder(scenes: PlannedProductScene[]): string[] {
    return this.orderScenes(scenes).map((scene) => `${scene.order}. ${scene.sceneName} (${scene.marketingFlowStage})`);
  }
}

export class ProductUtilizationEngine {
  assign(scenes: PlannedProductScene[], ctx: PlanningContext): PlannedProductScene[] {
    return scenes.map((scene) => {
      const asset = pickAsset(scene.productView, ctx.assets) ?? ctx.assets[0]!;
      const utilization: ProductUtilizationPlan = {
        assetId: asset.assetId,
        sourceImageId: asset.sourceImageId,
        viewType: asset.viewType,
        appearance: appearanceFor(scene.sceneType),
        displayDurationSeconds: scene.durationSeconds,
        rotation: rotationFor(scene.sceneType),
        zoom: zoomFor(scene.sceneType),
        movement: scene.cameraMovement,
        highlightSequence: highlightFor(scene, ctx),
      };
      return {
        ...scene,
        productView: asset.viewType,
        productUtilization: [utilization],
      };
    });
  }

  coverage(scenes: PlannedProductScene[], assets: ProductAssetRecord[]): ProductScenePlanResult["productUsageCoverage"] {
    return assets.map((asset) => ({
      assetId: asset.assetId,
      viewType: asset.viewType,
      sceneIds: scenes
        .filter((scene) => scene.productUtilization.some((item) => item.assetId === asset.assetId))
        .map((scene) => scene.sceneId),
    }));
  }
}

export class SceneKnowledgeBridge {
  domainsUsed(core: AiCoreManager | null): string[] {
    const offline = [
      "video-production",
      "storytelling",
      "camera",
      "lighting",
      "composition",
      "marketing",
      "branding",
      "customer-psychology",
      "social-media",
    ];
    const foundation = core?.knowledgeFoundation as
      | {
          isStartupComplete?: () => boolean;
          getProfessionalVideoProductionKnowledge?: () => unknown;
          getProfessionalStorytellingSceneKnowledge?: () => unknown;
          getProfessionalCameraKnowledge?: () => unknown;
          getProfessionalLightingCompositionKnowledge?: () => unknown;
          getProfessionalMarketingBrandingPsychologyKnowledge?: () => unknown;
        }
      | null
      | undefined;
    if (!foundation?.isStartupComplete?.()) return offline;
    const available: string[] = [];
    try {
      if (foundation.getProfessionalVideoProductionKnowledge?.()) available.push("video-production");
      if (foundation.getProfessionalStorytellingSceneKnowledge?.()) available.push("storytelling");
      if (foundation.getProfessionalCameraKnowledge?.()) available.push("camera");
      if (foundation.getProfessionalLightingCompositionKnowledge?.()) available.push("lighting", "composition");
      if (foundation.getProfessionalMarketingBrandingPsychologyKnowledge?.()) {
        available.push("marketing", "branding", "customer-psychology");
      }
    } catch {
      return offline;
    }
    return available.length ? uniqueStrings([...available, "social-media"]) : offline;
  }
}

export class ScenePlanningQualityEngine {
  evaluate(scenes: PlannedProductScene[], ctx: PlanningContext): ScenePlanningQuality {
    const issues: string[] = [];
    const types = new Set(scenes.map((scene) => scene.sceneType));
    if (!types.has("call-to-action")) issues.push("missing call-to-action");
    if (!types.has("product-reveal")) issues.push("missing product-reveal");
    if (!types.has("hero-introduction")) issues.push("missing hero-introduction");
    const ordered = [...scenes].sort((a, b) => a.order - b.order);
    for (let i = 1; i < ordered.length; i += 1) {
      if (FLOW_ORDER.indexOf(ordered[i]!.marketingFlowStage) + 2 < FLOW_ORDER.indexOf(ordered[i - 1]!.marketingFlowStage)) {
        issues.push("weak flow order");
        break;
      }
    }
    const usedAssets = new Set(scenes.flatMap((scene) => scene.productUtilization.map((item) => item.assetId)));
    if (ctx.assets.some((asset) => !usedAssets.has(asset.assetId)) && scenes.length < ctx.assets.length) {
      issues.push("unused product asset");
    }
    if (scenes.some((scene) => !scene.cameraAngle || !scene.cameraMovement)) issues.push("incomplete camera planning");
    if (scenes.some((scene) => !scene.lightingStyle)) issues.push("incomplete lighting planning");
    if (scenes.some((scene) => scene.productUtilization.length === 0)) issues.push("product usage incomplete");

    const sceneCompleteness = Math.min(100, Math.round((types.size / 8) * 100));
    const sceneOrderScore = issues.includes("weak flow order") ? 55 : 90;
    const marketingFlowScore = ["attention", "product-reveal", "call-to-action"].every((stage) =>
      scenes.some((scene) => scene.marketingFlowStage === stage),
    ) ? 92 : 60;
    const productUsageScore = scenes.every((scene) => scene.productUtilization.length > 0) ? 90 : 50;
    const cameraPlanningScore = scenes.every((scene) => scene.cameraAngle && scene.cameraMovement) ? 90 : 50;
    const lightingPlanningScore = scenes.every((scene) => scene.lightingStyle && scene.backgroundStyle) ? 90 : 50;
    const overall = Math.round(
      (sceneCompleteness + sceneOrderScore + marketingFlowScore + productUsageScore + cameraPlanningScore + lightingPlanningScore) / 6,
    );
    return {
      sceneCompleteness,
      sceneOrderScore,
      marketingFlowScore,
      productUsageScore,
      cameraPlanningScore,
      lightingPlanningScore,
      overall,
      issues,
      repairs: [],
    };
  }
}

export class ProductSceneHealthManager {
  constructor(private readonly manager: ProductScenePlanningManager) {}

  async check(projectId?: string): Promise<ProductSceneHealthReport> {
    const checks: ProductSceneHealthReport["checks"] = [];
    checks.push({
      name: "runtime-initialized",
      passed: this.manager.isInitialized(),
      detail: this.manager.isInitialized() ? "ready" : "not initialized",
    });
    const awareness = this.manager.getAiMeProductScenePlanningAwareness();
    checks.push({
      name: "ai-me-awareness",
      passed: awareness.available && awareness.canExplainScenes && awareness.storyboardGenerationDeferred,
      detail: awareness.summary,
    });
    if (projectId) {
      try {
        const plan = await this.manager.planProductScenes(projectId);
        checks.push({
          name: "scene-completeness",
          passed: plan.sceneCount >= 4 && plan.quality.sceneCompleteness >= 50,
          detail: `scenes=${plan.sceneCount}; completeness=${plan.quality.sceneCompleteness}`,
        });
        checks.push({
          name: "scene-order",
          passed: plan.quality.sceneOrderScore >= 70,
          detail: `orderScore=${plan.quality.sceneOrderScore}`,
        });
        checks.push({
          name: "marketing-flow",
          passed: plan.quality.marketingFlowScore >= 70 && plan.weakFlowNotes.length <= 2,
          detail: `flowScore=${plan.quality.marketingFlowScore}; weak=${plan.weakFlowNotes.length}`,
        });
        checks.push({
          name: "product-usage",
          passed: plan.quality.productUsageScore >= 70,
          detail: `usageScore=${plan.quality.productUsageScore}`,
        });
        checks.push({
          name: "camera-planning",
          passed: plan.quality.cameraPlanningScore >= 70,
          detail: `cameraScore=${plan.quality.cameraPlanningScore}`,
        });
        checks.push({
          name: "lighting-planning",
          passed: plan.quality.lightingPlanningScore >= 70,
          detail: `lightingScore=${plan.quality.lightingPlanningScore}`,
        });
        checks.push({
          name: "no-storyboard-video",
          passed: plan.storyboardGenerationDeferred && plan.videoGenerationDeferred,
          detail: "storyboard and video deferred",
        });
      } catch (error) {
        checks.push({
          name: "scene-completeness",
          passed: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const criticalIssues = checks.filter((check) => !check.passed).map((check) => `${check.name}: ${check.detail}`);
    return { healthy: criticalIssues.length === 0, checks, repaired: [], criticalIssues };
  }

  async repair(projectId?: string): Promise<ProductSceneHealthReport> {
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
      this.manager["store"].plans = this.manager["store"].plans.filter((plan) => plan.projectId !== projectId);
      for (const [key, planId] of Object.entries(this.manager["store"].cache)) {
        if (!this.manager["store"].plans.some((plan) => plan.planId === planId)) delete this.manager["store"].cache[key];
      }
      repaired.push("cleared-project-scene-cache");
      await this.manager.planProductScenes(projectId);
      repaired.push("re-planned-product-scenes");
    }
    await this.manager.persist();
    repaired.push("persisted-plans");
    const report = await this.check(projectId);
    return { ...report, repaired };
  }
}

function resolveMarketingGoal(project: CreativeProject): string {
  return project.campaignInformation.objective.trim()
    || project.campaignInformation.callToAction?.trim()
    || project.campaignInformation.name.trim()
    || "Promote the product with a clear call to action";
}

function pickView(preferred: ProductAssetViewType[], assets: ProductAssetRecord[]): ProductAssetViewType {
  for (const view of preferred) {
    if (assets.some((asset) => asset.viewType === view)) return view;
  }
  return assets[0]?.viewType ?? "front";
}

function pickAsset(view: ProductAssetViewType, assets: ProductAssetRecord[]): ProductAssetRecord | undefined {
  return assets.find((asset) => asset.viewType === view) ?? assets[0];
}

function uniqueBlueprints(items: SceneBlueprint[]): SceneBlueprint[] {
  const seen = new Set<ProductSceneType>();
  return items.filter((item) => {
    if (seen.has(item.sceneType)) return false;
    seen.add(item.sceneType);
    return true;
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function objectiveFor(blueprint: SceneBlueprint, ctx: PlanningContext, feature: string): string {
  switch (blueprint.sceneType) {
    case "hero-introduction": return `Capture attention for ${ctx.product.productName}`;
    case "product-reveal": return `Reveal ${ctx.product.productName} clearly`;
    case "feature-highlight": return `Highlight ${feature}`;
    case "price-presentation": return `Present price ${ctx.product.price ?? ""} ${ctx.product.currency ?? ""}`.trim();
    case "call-to-action": return `Drive action: ${ctx.project.campaignInformation.callToAction || ctx.marketingGoal}`;
    case "brand-scene": return `Reinforce ${ctx.product.brand} trust`;
    default: return `Advance ${blueprint.flow} for ${ctx.product.productName}`;
  }
}

function purposeFor(blueprint: SceneBlueprint): string {
  return `${blueprint.sceneName} supports the ${blueprint.flow} stage of the marketing flow.`;
}

function whyFor(blueprint: SceneBlueprint, ctx: PlanningContext, feature: string): string {
  return `${blueprint.sceneName} exists to serve ${blueprint.flow} for ${ctx.product.productName}`
    + (blueprint.sceneType === "feature-highlight" ? ` by featuring ${feature}` : "")
    + ` toward the goal "${ctx.marketingGoal}".`;
}

function appearanceFor(type: ProductSceneType): string {
  if (type.includes("close") || type === "detail-showcase" || type === "material-close-up") return "cutout product detail dominant in frame";
  if (type === "lifestyle-scene") return "cutout product composited into lifestyle context";
  if (type === "call-to-action" || type === "closing-scene") return "hero cutout with end-card lockup space";
  return "centered transparent product cutout";
}

function rotationFor(type: ProductSceneType): string {
  if (type === "showcase-360" || type === "product-rotation") return "full yaw rotation";
  if (type === "product-reveal") return "quarter-turn reveal";
  return "none";
}

function zoomFor(type: ProductSceneType): string {
  if (type === "material-close-up" || type === "detail-showcase") return "macro zoom-in";
  if (type === "hero-introduction") return "slow zoom-in";
  return "stable framing";
}

function highlightFor(scene: PlannedProductScene, ctx: PlanningContext): string {
  const point = ctx.product.sellingPoints[0]?.point || ctx.product.features[0] || ctx.product.productName;
  return `${scene.sceneName}: emphasize ${point}`;
}

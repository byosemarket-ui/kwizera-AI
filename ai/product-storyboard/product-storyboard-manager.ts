import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { ProductAssetPreparationManager } from "../product-asset-preparation/product-asset-preparation-manager.js";
import type { ProductAssetPreparationResult } from "../product-asset-preparation/types.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import type { ProductScenePlanningManager } from "../product-scene-planning/product-scene-planning-manager.js";
import type { PlannedProductScene, ProductScenePlanResult } from "../product-scene-planning/types.js";
import type {
  AiMeProductStoryboardAwareness,
  MarketingScriptPackage,
  ProductStoryboardExplainResult,
  ProductStoryboardHealthReport,
  ProductStoryboardResult,
  ProductStoryboardStore,
  StoryboardMarketingBeat,
  StoryboardQuality,
  StoryboardScenePanel,
} from "./types.js";

const EMPTY: ProductStoryboardStore = { storyboards: [], cache: {}, history: [], logs: [] };

const REQUIRED_BEATS: StoryboardMarketingBeat[] = [
  "attention",
  "interest",
  "desire",
  "trust",
  "product-value",
  "call-to-action",
];

/** Step 4 runtime: storyboard panels + marketing/voice/visual scripts from Steps 1–3. No video or prompt orchestration. */
export class ProductStoryboardManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private workspace: CreativeWorkspaceManager | null = null;
  private products: ProductIntelligenceManager | null = null;
  private assets: ProductAssetPreparationManager | null = null;
  private scenes: ProductScenePlanningManager | null = null;
  private store: ProductStoryboardStore = structuredClone(EMPTY);

  readonly panels = new StoryboardPanelEngine();
  readonly scripts = new MarketingScriptEngine();
  readonly flow = new StoryboardFlowEngine();
  readonly quality = new StoryboardQualityEngine();
  readonly knowledge = new StoryboardKnowledgeBridge();
  readonly health = new ProductStoryboardHealthManager(this);

  async initialize(
    storageRoot: string,
    dependencies: {
      core: AiCoreManager;
      workspace: CreativeWorkspaceManager;
      products: ProductIntelligenceManager;
      assets: ProductAssetPreparationManager;
      scenes: ProductScenePlanningManager;
    },
  ): Promise<void> {
    this.root = path.join(storageRoot, "product-storyboard-runtime");
    this.core = dependencies.core;
    this.workspace = dependencies.workspace;
    this.products = dependencies.products;
    this.assets = dependencies.assets;
    this.scenes = dependencies.scenes;
    await fs.mkdir(this.root, { recursive: true });
    this.store = await this.readStore();
    this.log("info", "Product storyboard runtime restored.");
    await this.persist();
  }

  isInitialized(): boolean {
    return Boolean(this.root && this.workspace && this.products && this.assets && this.scenes);
  }

  async generateStoryboardAndScript(projectId: string): Promise<ProductStoryboardResult> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");

    const product = (await this.products!.getProfile(projectId))
      ?? (await this.products!.analyzeProductIntelligence(projectId));
    const prepared = (await this.assets!.getResult(projectId))
      ?? (await this.assets!.prepareProductAssets(projectId));
    if (!prepared.assets.length) throw new Error("Prepare product assets (Step 2) before storyboard generation.");
    const scenePlan = (await this.scenes!.getPlan(projectId))
      ?? (await this.scenes!.planProductScenes(projectId));
    if (!scenePlan.scenes.length) throw new Error("Plan product scenes (Step 3) before storyboard generation.");

    const marketingObjective = scenePlan.marketingGoal || project.campaignInformation.objective || "Promote the product";
    const cacheKey = this.cacheKey(project, product, prepared, scenePlan, marketingObjective);
    const cachedId = this.store.cache[cacheKey];
    const cached = cachedId ? this.store.storyboards.find((item) => item.storyboardId === cachedId) : undefined;
    if (cached) return { ...cached, cached: true };

    const knowledgeUsed = this.knowledge.domainsUsed(this.core);
    let panels = this.panels.build(scenePlan, product, project, knowledgeUsed);
    let marketingScript = this.scripts.build(product, project, marketingObjective, panels);
    let quality = this.quality.evaluate(panels, marketingScript, prepared, scenePlan);
    const repairs: string[] = [];

    if (quality.issues.length) {
      const repaired = this.applyQualityRepairs(panels, marketingScript, product, project, marketingObjective, quality.issues);
      panels = repaired.panels;
      marketingScript = repaired.script;
      repairs.push(...repaired.repairs);
      quality = this.quality.evaluate(panels, marketingScript, prepared, scenePlan);
      quality.repairs = repairs;
    }

    const beats = this.flow.beatsPresent(panels);
    const missingBeats = this.flow.missingBeats(beats, product, project);
    const weakFlowNotes = this.flow.detectWeakFlow(panels, beats);
    const missingScenes = this.flow.detectMissingScenes(panels, scenePlan);
    const timing = buildTiming(panels);
    const now = new Date().toISOString();
    const result: ProductStoryboardResult = {
      storyboardId: randomUUID(),
      projectId,
      productId: product.id,
      storyboardTitle: `${product.productName} Marketing Storyboard`,
      marketingObjective,
      targetAudience: project.targetAudience || product.targetAudience || "general audience",
      totalScenes: panels.length,
      sceneSequence: panels.map((panel) => `${panel.sceneNumber}. ${panel.scenePurpose}`),
      sceneTiming: timing,
      panels,
      marketingScript,
      marketingBeatsPresent: beats,
      missingBeats,
      missingScenes,
      weakFlowNotes,
      improvementRecommendations: this.buildImprovements(panels, marketingScript, missingBeats, weakFlowNotes, missingScenes),
      quality,
      knowledgeUsed,
      creativePipelineStep: 4,
      promptOrchestrationDeferred: true,
      videoGenerationDeferred: true,
      createdAt: now,
      updatedAt: now,
      cached: false,
    };

    this.store.storyboards = this.store.storyboards.filter((item) => item.projectId !== projectId);
    this.store.storyboards.unshift(result);
    this.store.cache[cacheKey] = result.storyboardId;
    this.history(projectId, "generate", `Generated storyboard with ${result.totalScenes} panel(s) for ${product.productName}.`);
    this.log("info", `Product storyboard ready for ${project.name}.`);
    await this.persist();
    return structuredClone(result);
  }

  async getStoryboard(projectId: string): Promise<ProductStoryboardResult | null> {
    return this.store.storyboards.find((item) => item.projectId === projectId) ?? null;
  }

  async explainStoryboard(projectId: string): Promise<ProductStoryboardExplainResult> {
    const board = (await this.getStoryboard(projectId)) ?? (await this.generateStoryboardAndScript(projectId));
    return {
      storyboardId: board.storyboardId,
      productName: board.storyboardTitle.replace(/ Marketing Storyboard$/, ""),
      summary: `${board.storyboardTitle}: ${board.totalScenes} scenes for "${board.marketingObjective}". Prompt orchestration and video generation remain deferred.`,
      storyboardDecisions: board.panels.map((panel) => ({
        sceneNumber: panel.sceneNumber,
        decision: panel.whyThisDecision,
      })),
      scriptDecisions: [
        { section: "openingHook", decision: board.marketingScript.openingHook },
        { section: "productIntroduction", decision: board.marketingScript.productIntroduction },
        { section: "callToAction", decision: board.marketingScript.callToAction },
        { section: "closingMessage", decision: board.marketingScript.closingMessage },
      ],
      improvementRecommendations: board.improvementRecommendations,
      missingScenes: board.missingScenes,
      weakFlowNotes: board.weakFlowNotes,
      readyForPromptOrchestration: board.quality.overall >= 70 && board.quality.ctaPlacementScore >= 70,
    };
  }

  async recommendImprovements(projectId: string): Promise<string[]> {
    const board = (await this.getStoryboard(projectId)) ?? (await this.generateStoryboardAndScript(projectId));
    return [...board.improvementRecommendations];
  }

  async detectMissingScenes(projectId: string): Promise<string[]> {
    const board = (await this.getStoryboard(projectId)) ?? (await this.generateStoryboardAndScript(projectId));
    return [...board.missingScenes];
  }

  async detectWeakMarketingFlow(projectId: string): Promise<string[]> {
    const board = (await this.getStoryboard(projectId)) ?? (await this.generateStoryboardAndScript(projectId));
    return [...board.weakFlowNotes];
  }

  getAiMeProductStoryboardAwareness(): AiMeProductStoryboardAwareness {
    const available = this.isInitialized();
    return {
      available,
      enabled: available,
      offlineFirst: true,
      canExplainStoryboardDecisions: available,
      canExplainScriptDecisions: available,
      canRecommendImprovements: available,
      canDetectMissingScenes: available,
      canDetectWeakMarketingFlow: available,
      promptOrchestrationDeferred: true,
      videoGenerationDeferred: true,
      summary: available
        ? "AI Me Product Storyboard is online: explain storyboard/script decisions, recommend improvements, detect missing scenes and weak marketing flow. Prompt orchestration and video generation remain deferred."
        : "Product Storyboard runtime is not initialized.",
    };
  }

  async runHealthCheck(projectId?: string): Promise<ProductStoryboardHealthReport> {
    return this.health.check(projectId);
  }

  async repair(projectId?: string): Promise<ProductStoryboardHealthReport> {
    return this.health.repair(projectId);
  }

  async getDashboard(projectId?: string): Promise<{
    storyboards: ProductStoryboardResult[];
    history: ProductStoryboardStore["history"];
    logs: ProductStoryboardStore["logs"];
    awareness: AiMeProductStoryboardAwareness;
    analytics: Record<string, number>;
  }> {
    const storyboards = this.store.storyboards.filter((item) => !projectId || item.projectId === projectId);
    return {
      storyboards: structuredClone(storyboards),
      history: this.store.history.filter((item) => !projectId || item.projectId === projectId),
      logs: [...this.store.logs],
      awareness: this.getAiMeProductStoryboardAwareness(),
      analytics: {
        storyboards: storyboards.length,
        averageScenes: storyboards.length ? Math.round(storyboards.reduce((sum, item) => sum + item.totalScenes, 0) / storyboards.length) : 0,
        averageQuality: storyboards.length ? Math.round(storyboards.reduce((sum, item) => sum + item.quality.overall, 0) / storyboards.length) : 0,
        cached: Object.keys(this.store.cache).length,
      },
    };
  }

  async persist(): Promise<void> {
    await fs.writeFile(path.join(this.root, "storyboards.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8");
  }

  log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.unshift({ at: new Date().toISOString(), level, message });
    this.store.logs.splice(100);
    this.core?.logger.info("product-storyboard", message);
  }

  history(projectId: string, event: string, detail: string): void {
    this.store.history.unshift({ id: randomUUID(), at: new Date().toISOString(), projectId, event, detail });
    this.store.history.splice(100);
  }

  private cacheKey(
    project: CreativeProject,
    product: ProductIntelligenceProfile,
    prepared: ProductAssetPreparationResult,
    scenePlan: ProductScenePlanResult,
    marketingObjective: string,
  ): string {
    return createHash("sha256")
      .update(JSON.stringify({
        projectId: project.id,
        productId: product.id,
        planId: scenePlan.planId,
        marketingObjective,
        audience: project.targetAudience,
        assets: prepared.assets.map((asset) => [asset.assetId, asset.fingerprint]),
        scenes: scenePlan.scenes.map((scene) => [scene.sceneId, scene.order, scene.sceneType]),
      }))
      .digest("hex");
  }

  private applyQualityRepairs(
    panels: StoryboardScenePanel[],
    script: MarketingScriptPackage,
    product: ProductIntelligenceProfile,
    project: CreativeProject,
    marketingObjective: string,
    issues: string[],
  ): { panels: StoryboardScenePanel[]; script: MarketingScriptPackage; repairs: string[] } {
    const repairs: string[] = [];
    let nextPanels = [...panels];
    let nextScript = { ...script };

    if (issues.some((issue) => issue.includes("missing CTA"))) {
      nextPanels = nextPanels.map((panel) =>
        panel.marketingBeat === "call-to-action" || panel.sceneType === "call-to-action" || panel.sceneType === "closing-scene"
          ? {
              ...panel,
              ctaPlacement: panel.ctaPlacement.includes("none")
                ? "lower-third CTA button, right-aligned"
                : panel.ctaPlacement,
              onScreenText: panel.onScreenText || (project.campaignInformation.callToAction || "Shop now"),
            }
          : panel,
      );
      if (!nextScript.callToAction.trim()) {
        nextScript.callToAction = project.campaignInformation.callToAction || `Get your ${product.productName} today.`;
      }
      repairs.push("strengthened-cta-placement");
    }

    if (issues.some((issue) => issue.includes("weak marketing flow"))) {
      nextPanels = [...nextPanels].sort((a, b) => beatRank(a.marketingBeat) - beatRank(b.marketingBeat) || a.sceneNumber - b.sceneNumber)
        .map((panel, index) => ({ ...panel, sceneNumber: index + 1 }));
      repairs.push("reordered-storyboard-beats");
    }

    if (issues.some((issue) => issue.includes("product usage"))) {
      nextPanels = nextPanels.map((panel) => ({
        ...panel,
        productPosition: panel.productPosition || "center frame using prepared cutout",
        sceneDescription: panel.sceneDescription.includes(product.productName)
          ? panel.sceneDescription
          : `${panel.sceneDescription} Featuring uploaded ${product.productName}.`,
      }));
      repairs.push("reinforced-actual-product-usage");
    }

    if (issues.some((issue) => issue.includes("incomplete script"))) {
      nextScript = this.scripts.build(product, project, marketingObjective, nextPanels);
      repairs.push("regenerated-marketing-script");
    }

    return { panels: nextPanels, script: nextScript, repairs };
  }

  private buildImprovements(
    panels: StoryboardScenePanel[],
    script: MarketingScriptPackage,
    missingBeats: StoryboardMarketingBeat[],
    weakFlowNotes: string[],
    missingScenes: string[],
  ): string[] {
    const tips: string[] = [];
    if (missingBeats.length) tips.push(`Add coverage for marketing beats: ${missingBeats.join(", ")}.`);
    if (missingScenes.length) tips.push(`Scene plan gaps: ${missingScenes.join("; ")}.`);
    if (weakFlowNotes.length) tips.push(...weakFlowNotes.slice(0, 3));
    if (!script.promotionalMessage || script.promotionalMessage.includes("not specified")) {
      tips.push("Add an explicit promotional offer in campaign notes for a stronger offer beat.");
    }
    if (panels.every((panel) => panel.durationSeconds < 2.5)) {
      tips.push("Consider slightly longer holds on feature/detail scenes for clarity.");
    }
    if (!tips.length) tips.push("Storyboard and script are production-ready for prompt orchestration.");
    return tips;
  }

  private async readStore(): Promise<ProductStoryboardStore> {
    try {
      const value = JSON.parse(await fs.readFile(path.join(this.root, "storyboards.json"), "utf8")) as Partial<ProductStoryboardStore>;
      return {
        ...structuredClone(EMPTY),
        ...value,
        storyboards: value.storyboards ?? [],
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
    if (!this.isInitialized()) throw new Error("Product Storyboard Manager is not initialized");
  }
}

export class StoryboardPanelEngine {
  build(
    scenePlan: ProductScenePlanResult,
    product: ProductIntelligenceProfile,
    project: CreativeProject,
    knowledgeUsed: string[],
  ): StoryboardScenePanel[] {
    return scenePlan.scenes.map((scene, index) => this.panelFromScene(scene, index + 1, product, project, knowledgeUsed));
  }

  private panelFromScene(
    scene: PlannedProductScene,
    sceneNumber: number,
    product: ProductIntelligenceProfile,
    project: CreativeProject,
    knowledgeUsed: string[],
  ): StoryboardScenePanel {
    const util = scene.productUtilization[0];
    const feature = product.sellingPoints[0]?.point || product.features[0] || product.productName;
    const priceLabel = typeof product.price === "number"
      ? `${product.currency ?? ""} ${product.price}`.trim()
      : "";
    const cta = project.campaignInformation.callToAction || "Shop now";
    const beat = mapBeat(scene.marketingFlowStage, scene.sceneType);
    const showPrice = beat === "price" || scene.sceneType === "price-presentation";
    const showCta = beat === "call-to-action" || scene.sceneType === "call-to-action" || scene.sceneType === "closing-scene";
    const showLogo = beat === "trust" || scene.sceneType === "brand-scene" || scene.sceneType === "closing-scene" || scene.sceneType === "hero-introduction";

    return {
      sceneNumber,
      sceneId: scene.sceneId,
      sceneType: scene.sceneType,
      scenePurpose: scene.objective,
      sceneDescription: describeScene(scene, product, feature),
      marketingBeat: beat,
      durationSeconds: scene.durationSeconds,
      productPosition: util?.appearance || "centered prepared product cutout",
      productView: util?.viewType || scene.productView,
      assetId: util?.assetId || "",
      sourceImageId: util?.sourceImageId || "",
      cameraAngle: scene.cameraAngle,
      cameraMovement: scene.cameraMovement,
      lightingStyle: scene.lightingStyle,
      backgroundDescription: scene.backgroundStyle,
      environment: scene.environment,
      animationInstructions: `${scene.animationStyle}; ${util?.highlightSequence || "hold product focus"}`,
      transition: scene.transitionType,
      onScreenText: onScreenFor(scene, product, feature, priceLabel, cta),
      productPricePlacement: showPrice && priceLabel
        ? "lower-left price card beside product"
        : "none — price not presented in this scene",
      logoPlacement: showLogo
        ? (product.brand && !product.brand.includes("requires") ? "upper-left brand mark" : "none — brand not confirmed")
        : "none",
      ctaPlacement: showCta ? "lower-third CTA button, right-aligned" : "none",
      voice: {
        narration: narrationFor(scene, product, feature, priceLabel, cta, project),
        voiceTimingSeconds: Math.max(1.5, scene.durationSeconds - 0.3),
        speakingPace: paceFor(scene.sceneType),
        emotion: emotionFor(beat),
        tone: toneFor(project, beat),
        emphasis: emphasisFor(scene, product, feature, priceLabel, cta),
      },
      visual: {
        cameraInstructions: `${scene.cameraAngle}; movement: ${scene.cameraMovement}`,
        lightingInstructions: scene.lightingStyle,
        productRotation: util?.rotation || "none",
        zoomInstructions: util?.zoom || "stable framing",
        motionInstructions: util?.movement || scene.cameraMovement,
        backgroundInstructions: `${scene.backgroundStyle} in ${scene.environment}`,
      },
      whyThisDecision: `${scene.whyThisScene} Storyboard panel ${sceneNumber} uses uploaded asset view "${util?.viewType || scene.productView}" and only stated product facts.`,
      knowledgeDomains: unique([...scene.knowledgeDomains, ...knowledgeUsed.filter((domain) => scene.knowledgeDomains.includes(domain) || ["storytelling", "marketing", "camera", "lighting"].includes(domain))]),
    };
  }
}

export class MarketingScriptEngine {
  build(
    product: ProductIntelligenceProfile,
    project: CreativeProject,
    marketingObjective: string,
    panels: StoryboardScenePanel[],
  ): MarketingScriptPackage {
    const feature = product.features[0] || product.sellingPoints[0]?.point || "its core design";
    const benefit = product.sellingPoints[1]?.point || product.functions[0] || `helps ${project.targetAudience || "customers"} achieve the campaign goal`;
    const highlights = unique([
      ...product.features.slice(0, 3),
      ...product.sellingPoints.map((item) => item.point).slice(0, 3),
      ...product.materials.filter((item) => !item.includes("verification")).slice(0, 2),
    ]).filter(Boolean);
    const price = typeof product.price === "number"
      ? `${product.currency ?? ""} ${product.price}`.trim()
      : "";
    const cta = project.campaignInformation.callToAction || "Shop now";
    const brand = product.brand && !product.brand.includes("requires") ? product.brand : "";
    const openingHook = panels.find((panel) => panel.marketingBeat === "attention")?.voice.narration
      || `Meet ${product.productName} — built for ${project.targetAudience || "you"}.`;
    const productIntroduction = `Introducing ${product.productName}${brand ? ` from ${brand}` : ""}. ${trimSentence(product.description)}`;
    const featurePresentation = `Key feature: ${feature}.`;
    const benefitPresentation = `Why it matters: ${benefit}.`;
    const trustBuilding = brand
      ? `Trusted design from ${brand}, created for ${project.targetAudience || "your audience"}.`
      : `Designed for ${project.targetAudience || "your audience"} with clear product value.`;
    const pricePresentation = price
      ? `Available at ${price}.`
      : "Pricing can be added when provided by the user.";
    const promotionalMessage = /offer|sale|promo|discount|launch/i.test(`${marketingObjective} ${project.campaignInformation.notes ?? ""}`)
      ? `Special campaign focus: ${marketingObjective}.`
      : "Promotional offer not specified by the user — omitted rather than invented.";
    const callToAction = `${cta}.`;
    const closingMessage = brand
      ? `${brand}. ${product.productName}. ${cta}.`
      : `${product.productName}. ${cta}.`;
    const fullNarration = [
      openingHook,
      productIntroduction,
      featurePresentation,
      benefitPresentation,
      trustBuilding,
      price ? pricePresentation : "",
      promotionalMessage.includes("not specified") ? "" : promotionalMessage,
      callToAction,
      closingMessage,
    ].filter(Boolean).join(" ");

    return {
      openingHook,
      productIntroduction,
      featurePresentation,
      benefitPresentation,
      productHighlights: highlights.length ? highlights : [product.productName],
      trustBuilding,
      pricePresentation,
      promotionalMessage,
      callToAction,
      closingMessage,
      fullNarration,
    };
  }
}

export class StoryboardFlowEngine {
  beatsPresent(panels: StoryboardScenePanel[]): StoryboardMarketingBeat[] {
    return unique(panels.map((panel) => panel.marketingBeat)) as StoryboardMarketingBeat[];
  }

  missingBeats(
    present: StoryboardMarketingBeat[],
    product: ProductIntelligenceProfile,
    project: CreativeProject,
  ): StoryboardMarketingBeat[] {
    const required = [...REQUIRED_BEATS];
    if (typeof product.price === "number") required.push("price");
    if (/offer|sale|promo|discount/i.test(`${project.campaignInformation.objective} ${project.campaignInformation.notes ?? ""}`)) {
      required.push("offer");
    }
    return required.filter((beat) => !present.includes(beat));
  }

  detectWeakFlow(panels: StoryboardScenePanel[], beats: StoryboardMarketingBeat[]): string[] {
    const notes: string[] = [];
    if (!beats.includes("attention")) notes.push("Storyboard lacks an attention opener.");
    if (!beats.includes("call-to-action")) notes.push("Storyboard lacks a call-to-action close.");
    for (let i = 1; i < panels.length; i += 1) {
      if (beatRank(panels[i]!.marketingBeat) + 3 < beatRank(panels[i - 1]!.marketingBeat)) {
        notes.push(`Marketing beat regresses between scenes ${panels[i - 1]!.sceneNumber} and ${panels[i]!.sceneNumber}.`);
      }
    }
    return notes;
  }

  detectMissingScenes(panels: StoryboardScenePanel[], scenePlan: ProductScenePlanResult): string[] {
    const present = new Set(panels.map((panel) => panel.sceneType));
    const missing: string[] = [];
    for (const type of ["hero-introduction", "product-reveal", "call-to-action"] as const) {
      if (!present.has(type)) missing.push(`Missing storyboard panel for ${type}`);
    }
    for (const scene of scenePlan.missingScenes) {
      missing.push(`Scene plan still missing ${scene}`);
    }
    return missing;
  }
}

export class StoryboardQualityEngine {
  evaluate(
    panels: StoryboardScenePanel[],
    script: MarketingScriptPackage,
    prepared: ProductAssetPreparationResult,
    scenePlan: ProductScenePlanResult,
  ): StoryboardQuality {
    const issues: string[] = [];
    if (!panels.length) issues.push("storyboard empty");
    if (panels.some((panel) => !panel.assetId && prepared.assets.length)) issues.push("product usage incomplete");
    if (panels.every((panel) => panel.ctaPlacement === "none") && !script.callToAction) issues.push("missing CTA");
    if (!panels.some((panel) => panel.ctaPlacement !== "none") && panels.some((panel) => panel.sceneType === "call-to-action")) {
      issues.push("missing CTA");
    }
    if (!script.openingHook || !script.productIntroduction || !script.callToAction) issues.push("incomplete script");
    const beats = unique(panels.map((panel) => panel.marketingBeat));
    if (!beats.includes("attention") || !beats.includes("call-to-action")) issues.push("weak marketing flow");
    if (panels.some((panel) => !panel.sceneDescription.includes(scenePlan.productName) && !panel.voice.narration.includes(scenePlan.productName))) {
      issues.push("product usage");
    }

    const storyboardScore = Math.min(100, 55 + panels.length * 4);
    const scriptScore = [script.openingHook, script.productIntroduction, script.featurePresentation, script.callToAction, script.closingMessage]
      .filter((item) => item && item.length > 8).length * 18;
    const sceneConsistencyScore = panels.every((panel, index) => panel.sceneNumber === index + 1) ? 92 : 60;
    const marketingFlowScore = ["attention", "call-to-action"].every((beat) => beats.includes(beat)) ? 90 : 55;
    const usedAssets = new Set(panels.map((panel) => panel.assetId).filter(Boolean));
    const productUsageScore = usedAssets.size > 0 ? Math.min(95, 60 + usedAssets.size * 15) : 40;
    const ctaPlacementScore = panels.some((panel) => panel.ctaPlacement !== "none") && script.callToAction ? 92 : 45;
    const overall = Math.round(
      (Math.min(100, storyboardScore) + Math.min(100, scriptScore) + sceneConsistencyScore + marketingFlowScore + productUsageScore + ctaPlacementScore) / 6,
    );
    return {
      storyboardScore: Math.min(100, storyboardScore),
      scriptScore: Math.min(100, scriptScore),
      sceneConsistencyScore,
      marketingFlowScore,
      productUsageScore,
      ctaPlacementScore,
      overall,
      issues,
      repairs: [],
    };
  }
}

export class StoryboardKnowledgeBridge {
  domainsUsed(core: AiCoreManager | null): string[] {
    const offline = [
      "video-production",
      "storytelling",
      "marketing",
      "branding",
      "customer-psychology",
      "camera",
      "lighting",
      "composition",
      "video-editing",
      "rendering",
    ];
    const foundation = core?.knowledgeFoundation as { isStartupComplete?: () => boolean } | null | undefined;
    if (!foundation?.isStartupComplete?.()) return offline;
    return offline;
  }
}

export class ProductStoryboardHealthManager {
  constructor(private readonly manager: ProductStoryboardManager) {}

  async check(projectId?: string): Promise<ProductStoryboardHealthReport> {
    const checks: ProductStoryboardHealthReport["checks"] = [];
    checks.push({
      name: "runtime-initialized",
      passed: this.manager.isInitialized(),
      detail: this.manager.isInitialized() ? "ready" : "not initialized",
    });
    const awareness = this.manager.getAiMeProductStoryboardAwareness();
    checks.push({
      name: "ai-me-awareness",
      passed: awareness.available && awareness.canExplainStoryboardDecisions && awareness.videoGenerationDeferred,
      detail: awareness.summary,
    });
    if (projectId) {
      try {
        const board = await this.manager.generateStoryboardAndScript(projectId);
        checks.push({
          name: "storyboard-generation",
          passed: board.totalScenes >= 4 && board.panels.length === board.totalScenes,
          detail: `scenes=${board.totalScenes}; score=${board.quality.storyboardScore}`,
        });
        checks.push({
          name: "script-generation",
          passed: board.quality.scriptScore >= 70 && Boolean(board.marketingScript.fullNarration),
          detail: `scriptScore=${board.quality.scriptScore}`,
        });
        checks.push({
          name: "scene-consistency",
          passed: board.quality.sceneConsistencyScore >= 70,
          detail: `consistency=${board.quality.sceneConsistencyScore}`,
        });
        checks.push({
          name: "marketing-flow",
          passed: board.quality.marketingFlowScore >= 70,
          detail: `flow=${board.quality.marketingFlowScore}; weak=${board.weakFlowNotes.length}`,
        });
        checks.push({
          name: "product-usage",
          passed: board.quality.productUsageScore >= 70 && board.panels.every((panel) => panel.assetId),
          detail: `usage=${board.quality.productUsageScore}`,
        });
        checks.push({
          name: "cta-placement",
          passed: board.quality.ctaPlacementScore >= 70,
          detail: `cta=${board.quality.ctaPlacementScore}`,
        });
        checks.push({
          name: "no-video-prompt",
          passed: board.videoGenerationDeferred && board.promptOrchestrationDeferred,
          detail: "prompt orchestration and video deferred",
        });
      } catch (error) {
        checks.push({
          name: "storyboard-generation",
          passed: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const criticalIssues = checks.filter((check) => !check.passed).map((check) => `${check.name}: ${check.detail}`);
    return { healthy: criticalIssues.length === 0, checks, repaired: [], criticalIssues };
  }

  async repair(projectId?: string): Promise<ProductStoryboardHealthReport> {
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
      this.manager["store"].storyboards = this.manager["store"].storyboards.filter((item) => item.projectId !== projectId);
      for (const [key, id] of Object.entries(this.manager["store"].cache)) {
        if (!this.manager["store"].storyboards.some((item) => item.storyboardId === id)) delete this.manager["store"].cache[key];
      }
      repaired.push("cleared-project-storyboard-cache");
      await this.manager.generateStoryboardAndScript(projectId);
      repaired.push("regenerated-storyboard-and-script");
    }
    await this.manager.persist();
    repaired.push("persisted-storyboards");
    const report = await this.check(projectId);
    return { ...report, repaired };
  }
}

function mapBeat(stage: PlannedProductScene["marketingFlowStage"], sceneType: PlannedProductScene["sceneType"]): StoryboardMarketingBeat {
  if (sceneType === "promotional-offer" || stage === "offer") return "offer";
  if (sceneType === "price-presentation" || stage === "price") return "price";
  if (sceneType === "brand-scene" || stage === "trust") return "trust";
  if (stage === "attention" || sceneType === "hero-introduction") return "attention";
  if (stage === "interest" || sceneType === "showcase-360" || sceneType === "product-rotation") return "interest";
  if (stage === "product-reveal") return "desire";
  if (stage === "product-features" || stage === "benefits" || sceneType === "feature-highlight" || sceneType === "material-close-up" || sceneType === "detail-showcase" || sceneType === "lifestyle-scene") {
    return stage === "benefits" || sceneType === "lifestyle-scene" ? "desire" : "product-value";
  }
  if (stage === "call-to-action" || sceneType === "call-to-action" || sceneType === "closing-scene") return "call-to-action";
  return "interest";
}

function beatRank(beat: StoryboardMarketingBeat): number {
  return ["attention", "interest", "desire", "trust", "product-value", "price", "offer", "call-to-action"].indexOf(beat);
}

function describeScene(scene: PlannedProductScene, product: ProductIntelligenceProfile, feature: string): string {
  return `Scene shows the actual uploaded ${product.productName} (${scene.productView} view) for ${scene.purpose} Focus: ${feature}. Camera ${scene.cameraAngle} with ${scene.cameraMovement}; lighting ${scene.lightingStyle}; background ${scene.backgroundStyle}.`;
}

function onScreenFor(
  scene: PlannedProductScene,
  product: ProductIntelligenceProfile,
  feature: string,
  priceLabel: string,
  cta: string,
): string {
  if (scene.sceneType === "price-presentation" && priceLabel) return priceLabel;
  if (scene.sceneType === "call-to-action" || scene.sceneType === "closing-scene") return cta;
  if (scene.sceneType === "feature-highlight") return feature;
  if (scene.sceneType === "brand-scene" && product.brand && !product.brand.includes("requires")) return product.brand;
  if (scene.sceneType === "hero-introduction") return product.productName;
  return product.productName;
}

function narrationFor(
  scene: PlannedProductScene,
  product: ProductIntelligenceProfile,
  feature: string,
  priceLabel: string,
  cta: string,
  project: CreativeProject,
): string {
  switch (scene.sceneType) {
    case "hero-introduction":
      return `Look closer at ${product.productName}.`;
    case "product-reveal":
      return `This is ${product.productName}${product.brand && !product.brand.includes("requires") ? ` by ${product.brand}` : ""}.`;
    case "feature-highlight":
      return `${feature} — a standout detail of ${product.productName}.`;
    case "material-close-up":
      return product.materials.filter((item) => !item.includes("verification"))[0]
        ? `Crafted with ${product.materials.filter((item) => !item.includes("verification"))[0]}.`
        : `See the finish of ${product.productName}.`;
    case "price-presentation":
      return priceLabel ? `Yours for ${priceLabel}.` : `Discover ${product.productName}.`;
    case "call-to-action":
      return `${cta}.`;
    case "closing-scene":
      return `${product.productName}. ${cta}.`;
    case "lifestyle-scene":
      return `Made for ${project.targetAudience || "everyday use"}.`;
    case "brand-scene":
      return product.brand && !product.brand.includes("requires") ? `${product.brand} quality you can trust.` : `Quality you can trust.`;
    default:
      return `${product.productName}: ${scene.objective}.`;
  }
}

type StoryboardVoiceScriptPace = "slow" | "moderate" | "energetic";

function paceFor(sceneType: PlannedProductScene["sceneType"]): StoryboardVoiceScriptPace {
  if (sceneType === "call-to-action" || sceneType === "promotional-offer") return "energetic";
  if (sceneType === "material-close-up" || sceneType === "detail-showcase") return "slow";
  return "moderate";
}

function emotionFor(beat: StoryboardMarketingBeat): string {
  if (beat === "attention") return "curiosity";
  if (beat === "desire") return "aspiration";
  if (beat === "trust") return "confidence";
  if (beat === "call-to-action") return "urgency";
  return "clarity";
}

function toneFor(project: CreativeProject, beat: StoryboardMarketingBeat): string {
  if (beat === "call-to-action") return "direct and persuasive";
  if (project.brandInformation.voice?.trim()) return project.brandInformation.voice.trim();
  return "professional and warm";
}

function emphasisFor(
  scene: PlannedProductScene,
  product: ProductIntelligenceProfile,
  feature: string,
  priceLabel: string,
  cta: string,
): string[] {
  if (scene.sceneType === "price-presentation" && priceLabel) return [priceLabel];
  if (scene.sceneType === "call-to-action") return [cta];
  if (scene.sceneType === "feature-highlight") return [feature];
  return [product.productName];
}

function buildTiming(panels: StoryboardScenePanel[]): ProductStoryboardResult["sceneTiming"] {
  let cursor = 0;
  return panels.map((panel) => {
    const entry = { sceneNumber: panel.sceneNumber, startSeconds: Number(cursor.toFixed(2)), durationSeconds: panel.durationSeconds };
    cursor += panel.durationSeconds;
    return entry;
  });
}

function trimSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
